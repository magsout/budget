import { type DocumentData, onSnapshot, type QuerySnapshot } from "firebase/firestore";
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from "react";
import type {
  BudgetVersion,
  Category,
  Dataset,
  Expense,
  Income,
  RecurringExpense,
  User,
} from "../lib/types.ts";
import {
  budgetVersionsCol,
  categoriesCol,
  expensesCol,
  incomesCol,
  recurringExpensesCol,
  usersCol,
} from "./firestore.ts";

interface DataState {
  dataset: Dataset;
  loading: boolean;
  error: string | null;
  /** True while displayed data comes from the local cache (offline / not yet server-confirmed). */
  syncing: boolean;
  /** True while local writes are queued and not yet acknowledged by the server. */
  pendingWrites: boolean;
  /** Surface a terminal write failure in the shared error banner. */
  notifyError: (message: string) => void;
}

const EMPTY: Dataset = {
  users: [],
  categories: [],
  budgetVersions: [],
  expenses: [],
  recurringExpenses: [],
  incomes: [],
};

type CollectionKey =
  | "users"
  | "categories"
  | "budgetVersions"
  | "expenses"
  | "recurringExpenses"
  | "incomes";

const DataContext = createContext<DataState | null>(null);

function mapDocs<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/**
 * Subscribes to every collection in real time and assembles the in-memory
 * Dataset. Volume is tiny at household scale, so all balances are derived from
 * this snapshot on the client (see lib/budget.ts).
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Track which collections have delivered their first snapshot.
  const ready = useRef({
    users: false,
    categories: false,
    budgetVersions: false,
    expenses: false,
    recurringExpenses: false,
    incomes: false,
  });
  const [loading, setLoading] = useState(true);

  // Sync state derived from snapshot metadata. fromCache defaults true (assume stale
  // until the server confirms); hasPendingWrites defaults false.
  const [fromCache, setFromCache] = useState<Record<CollectionKey, boolean>>({
    users: true,
    categories: true,
    budgetVersions: true,
    expenses: true,
    recurringExpenses: true,
    incomes: true,
  });
  const [pending, setPending] = useState<Record<CollectionKey, boolean>>({
    users: false,
    categories: false,
    budgetVersions: false,
    expenses: false,
    recurringExpenses: false,
    incomes: false,
  });

  useEffect(() => {
    const markReady = (key: CollectionKey) => {
      ready.current[key] = true;
      if (Object.values(ready.current).every(Boolean)) setLoading(false);
    };

    // includeMetadataChanges is required: without it the cache→server confirmation
    // (same docs, fromCache flips true→false) is not delivered, so `syncing` would
    // latch true forever.
    const subscribe = <T,>(col: typeof usersCol, key: CollectionKey, set: (rows: T[]) => void) =>
      onSnapshot(
        col,
        { includeMetadataChanges: true },
        (s) => {
          set(mapDocs<T>(s));
          setFromCache((p) => ({ ...p, [key]: s.metadata.fromCache }));
          setPending((p) => ({ ...p, [key]: s.metadata.hasPendingWrites }));
          // Clear a stale error only on a server-confirmed snapshot, so one
          // collection's cache emission can't mask another's genuine error.
          if (!s.metadata.fromCache) setError(null);
          markReady(key);
        },
        // A network drop does not fire this — only terminal errors (e.g.
        // permission-denied) do. markReady so `loading` can resolve while the
        // already-cached data stays on screen.
        (e: Error) => {
          setError(e.message);
          markReady(key);
        },
      );

    const unsubs = [
      subscribe<User>(usersCol, "users", setUsers),
      subscribe<Category>(categoriesCol, "categories", setCategories),
      subscribe<BudgetVersion>(budgetVersionsCol, "budgetVersions", setBudgetVersions),
      subscribe<Expense>(expensesCol, "expenses", setExpenses),
      subscribe<RecurringExpense>(recurringExpensesCol, "recurringExpenses", setRecurringExpenses),
      subscribe<Income>(incomesCol, "incomes", setIncomes),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  const value = useMemo<DataState>(
    () => ({
      dataset: { users, categories, budgetVersions, expenses, recurringExpenses, incomes },
      loading,
      error,
      syncing: Object.values(fromCache).some(Boolean),
      pendingWrites: Object.values(pending).some(Boolean),
      notifyError: setError,
    }),
    [
      users,
      categories,
      budgetVersions,
      expenses,
      recurringExpenses,
      incomes,
      loading,
      error,
      fromCache,
      pending,
    ],
  );

  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataState {
  const ctx = use(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}

export { EMPTY as EMPTY_DATASET };
