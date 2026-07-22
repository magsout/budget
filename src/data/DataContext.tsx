import { type DocumentData, onSnapshot, type QuerySnapshot } from "firebase/firestore";
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from "react";
import type { BudgetVersion, Category, Dataset, Expense, User } from "../lib/types.ts";
import { budgetVersionsCol, categoriesCol, expensesCol, usersCol } from "./firestore.ts";

interface DataState {
  dataset: Dataset;
  loading: boolean;
  error: string | null;
}

const EMPTY: Dataset = { users: [], categories: [], budgetVersions: [], expenses: [] };

const DataContext = createContext<DataState | null>(null);

function mapDocs<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/**
 * Subscribes to the four collections in real time and assembles the in-memory
 * Dataset. Volume is tiny at household scale, so all balances are derived from
 * this snapshot on the client (see lib/budget.ts).
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Track which collections have delivered their first snapshot.
  const ready = useRef({ users: false, categories: false, budgetVersions: false, expenses: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const markReady = (key: keyof typeof ready.current) => {
      ready.current[key] = true;
      if (Object.values(ready.current).every(Boolean)) setLoading(false);
    };
    const onErr = (e: Error) => setError(e.message);

    const unsubs = [
      onSnapshot(
        usersCol,
        (s) => {
          setUsers(mapDocs<User>(s));
          markReady("users");
        },
        onErr,
      ),
      onSnapshot(
        categoriesCol,
        (s) => {
          setCategories(mapDocs<Category>(s));
          markReady("categories");
        },
        onErr,
      ),
      onSnapshot(
        budgetVersionsCol,
        (s) => {
          setBudgetVersions(mapDocs<BudgetVersion>(s));
          markReady("budgetVersions");
        },
        onErr,
      ),
      onSnapshot(
        expensesCol,
        (s) => {
          setExpenses(mapDocs<Expense>(s));
          markReady("expenses");
        },
        onErr,
      ),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  const value = useMemo<DataState>(
    () => ({
      dataset: { users, categories, budgetVersions, expenses },
      loading,
      error,
    }),
    [users, categories, budgetVersions, expenses, loading, error],
  );

  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataState {
  const ctx = use(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}

export { EMPTY as EMPTY_DATASET };
