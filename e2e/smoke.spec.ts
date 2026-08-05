import { expect, type Page, test } from "@playwright/test";

/**
 * Smoke coverage for what unit tests cannot see: that the screens actually
 * render, and that the interactions wired to them do what they claim.
 *
 * Assertions never depend on a write succeeding — the harness holds a static
 * dataset, so writes are queued and never confirmed. Anything needing a
 * persisted change is expressed in the fixture instead (see src/fixture).
 */

/** Fail the test on any console error, not just on a broken assertion. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function openSettings(page: Page) {
  await page.locator(".account-trigger").click();
  await page.getByRole("button", { name: "Réglages" }).click();
  await expect(page.getByRole("heading", { name: "Postes de dépenses" })).toBeVisible();
}

test.describe("Budget", () => {
  test("le tableau de bord s'affiche sans erreur console", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("fixture.html");

    await expect(page.getByText("Reste ce mois")).toBeVisible();
    await expect(page.getByRole("button", { name: /Courses/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Ajouter une dépense" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("le poste archivé n'apparaît pas dans le mois courant", async ({ page }) => {
    await page.goto("fixture.html");
    await expect(page.getByText("Vacances")).toHaveCount(0);
  });

  test("un report remis à zéro s'affiche « Report ignoré »", async ({ page }) => {
    await page.goto("fixture.html");
    await expect(page.getByText("Report ignoré")).toBeVisible();
  });

  test("le filtre par poste réduit la liste des dépenses", async ({ page }) => {
    await page.goto("fixture.html");

    const rows = page.locator(".list-item--btn");
    await expect(page.getByRole("button", { name: "Tous (5)" })).toBeVisible();
    await expect(rows).toHaveCount(5);

    await page.getByRole("button", { name: "Courses (3)" }).click();
    await expect(rows).toHaveCount(3);
    // Every remaining row belongs to the selected poste.
    await expect(rows.filter({ hasText: "Courses" })).toHaveCount(3);

    await page.getByRole("button", { name: "Tous (5)" }).click();
    await expect(rows).toHaveCount(5);
  });

  test("la dépense supprimée est absente du mois mais présente en corbeille", async ({ page }) => {
    await page.goto("fixture.html");
    await expect(page.getByText("Erreur")).toHaveCount(0);

    await openSettings(page);
    const trash = page.locator(".card").filter({ hasText: "Corbeille" });
    await expect(trash.getByText("Erreur")).toBeVisible();
    await expect(trash.getByRole("button", { name: "Restaurer" })).toBeVisible();
  });
});

test.describe("Réglages", () => {
  test("les flèches de réordonnancement sont bornées aux extrémités", async ({ page }) => {
    await page.goto("fixture.html");
    await openSettings(page);

    await expect(page.getByRole("button", { name: "Monter Courses" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Descendre Courses" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Descendre Maison & jardin" })).toBeDisabled();
  });

  test("un poste archivé est réactivable et annonce le report qui revient", async ({ page }) => {
    await page.goto("fixture.html");
    await openSettings(page);

    // Scoped to the postes card: a retired user further down also has a
    // "Réactiver" button.
    const postes = page.locator(".card").filter({ hasText: "Postes de dépenses" });
    await postes.getByRole("button", { name: /Postes archivés/ }).click();
    await expect(postes.getByText("Vacances")).toBeVisible();

    await postes.getByRole("button", { name: "Réactiver", exact: true }).click();
    await expect(postes.getByText(/revient avec lui/)).toBeVisible();
    await expect(postes.getByRole("button", { name: "Réactiver à zéro" })).toBeVisible();
  });

  test("un profil retiré est hors des sélecteurs mais réactivable", async ({ page }) => {
    await page.goto("fixture.html");
    await openSettings(page);

    const users = page.locator(".card").filter({ hasText: "Utilisateurs" });
    await expect(users.getByText("Colocataire")).toBeVisible();
    await expect(users.getByText("Retiré")).toBeVisible();

    // The retired profile must not be offered when logging an expense.
    await page.getByRole("button", { name: "Retour" }).click();
    await page.getByRole("button", { name: "+ Ajouter une dépense" }).click();
    const who = page.locator("#user");
    await expect(who.getByRole("option")).toHaveCount(2);
    await expect(who.getByRole("option", { name: "Colocataire" })).toHaveCount(0);
  });
});
