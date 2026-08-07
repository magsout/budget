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
    await expect(
      page.getByRole("button", { name: "Ajouter une dépense", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("la barre du bas marque l'onglet actif et navigue", async ({ page }) => {
    await page.goto("fixture.html");

    const bar = page.locator(".tabbar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Budget" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await bar.getByRole("button", { name: "Compte" }).click();
    await expect(bar.getByRole("button", { name: "Compte" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.getByRole("button", { name: "Budget" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    // The add button belongs to the Budget tab only.
    await expect(
      page.getByRole("button", { name: "Ajouter une dépense", exact: true }),
    ).toHaveCount(0);
  });

  test("la barre garde sa taille au scroll", async ({ page }) => {
    await page.goto("fixture.html");
    const nav = page.locator(".tabbar__nav");
    const before = await nav.boundingBox();

    await page.mouse.wheel(0, 500);
    await expect(page.locator(".tabbar__item").first()).toContainText("Budget");
    expect((await nav.boundingBox())?.height).toBe(before?.height);
  });

  test("taper un onglet remonte en haut de page", async ({ page }) => {
    await page.goto("fixture.html");
    const tabs = page.locator(".tabbar__item");
    const scrollY = () => page.evaluate("window.scrollY");
    // Both halves scroll on Budget: it is the only tab tall enough to give the
    // wheel real travel, so the assertions aren't measuring a few stray pixels.

    // Tapping the tab you are already on is "back to top".
    await page.mouse.wheel(0, 600);
    await expect.poll(scrollY).toBeGreaterThan(0);
    await tabs.nth(0).click();
    await expect.poll(scrollY).toBe(0);

    // Switching tabs: the next screen must not open mid-page.
    await page.mouse.wheel(0, 600);
    await expect.poll(scrollY).toBeGreaterThan(0);
    await tabs.nth(1).click();
    await expect.poll(scrollY).toBe(0);
    await expect(tabs.nth(1)).toHaveAttribute("aria-current", "page");
  });

  test("le slot du mini-player s'affiche dans le conteneur flottant", async ({ page }) => {
    await page.goto("fixture.html");
    await expect(page.locator(".tabbar__slot")).toHaveCount(0);

    await page.goto("fixture.html?sync=1");
    const slot = page.locator(".tabbar__slot");
    await expect(slot).toContainText("Synchronisation");
    // Same floating container as the tabs, above them.
    await expect(page.locator(".tabbar__shell .tabbar__slot")).toHaveCount(1);
  });

  test("la barre s'efface sur Réglages et revient au retour", async ({ page }) => {
    await page.goto("fixture.html");
    await openSettings(page);
    await expect(page.locator(".tabbar")).toHaveCount(0);

    await page.getByRole("button", { name: "Retour" }).click();
    await expect(page.locator(".tabbar")).toBeVisible();
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

  test("la recherche filtre par montant, par date, ou les deux", async ({ page }) => {
    await page.goto("fixture.html");
    const search = page.getByRole("searchbox", {
      name: "Rechercher une dépense par montant, date ou description",
    });
    const rows = page.locator(".list-item--btn");
    await expect(rows).toHaveCount(5);

    await search.fill("65");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("65,10");

    // A date, in the day/month form.
    await search.fill("7/8");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("7 août");

    // Two terms are ANDed: amount AND month.
    await search.fill("42 aout");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("42,50");

    // And by description.
    await search.fill("cinema");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Cinéma");

    await search.fill("999");
    await expect(rows).toHaveCount(0);
    await expect(page.getByText("Aucune dépense ne correspond")).toBeVisible();

    await search.fill("");
    await expect(rows).toHaveCount(5);
  });

  test("les compteurs de postes suivent la recherche", async ({ page }) => {
    await page.goto("fixture.html");
    await expect(page.getByRole("button", { name: "Tous (5)" })).toBeVisible();

    // August has every expense, so the chips stay — but Courses drops to 2.
    await page
      .getByRole("searchbox", { name: "Rechercher une dépense par montant, date ou description" })
      .fill("aout");
    await expect(page.getByRole("button", { name: "Tous (5)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Courses (3)" })).toBeVisible();
  });

  test("la répartition par personne totalise chaque profil", async ({ page }) => {
    await page.goto("fixture.html");

    const split = page.locator(".card").filter({ hasText: "Qui a dépensé quoi" });
    await expect(split.locator(".split")).toHaveCount(2);
    // Biggest spender first.
    await expect(split.locator(".split").first()).toContainText("Marie");
    await expect(split.locator(".split").first()).toContainText("2 dépenses");
  });

  test("un raccourci fréquent préremplit le formulaire en un tap", async ({ page }) => {
    await page.goto("fixture.html");
    await page.getByRole("button", { name: "Ajouter une dépense", exact: true }).click();

    await expect(page.locator("#amount")).toHaveValue("");
    await page.getByRole("button", { name: /Boulangerie/ }).click();

    await expect(page.locator("#amount")).toHaveValue("6,50");
    await expect(page.locator("#category")).toHaveValue("courses");
    await expect(page.locator("#description")).toHaveValue("Boulangerie");
    await expect(page.getByRole("button", { name: "Ajouter la dépense" })).toBeEnabled();
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

test.describe("Historique", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("fixture.html");
    await page.getByRole("button", { name: "Historique", exact: true }).click();
  });

  test("le filtre par poste s'applique aussi au mois passé", async ({ page }) => {
    const list = page.locator(".card").filter({ hasText: "Dépenses" }).last();
    await expect(list.locator(".list-item")).toHaveCount(4);

    await page.getByRole("button", { name: "Courses (2)" }).click();
    await expect(list.locator(".list-item")).toHaveCount(2);
  });

  test("la recherche s'applique aussi au mois passé", async ({ page }) => {
    const list = page.locator(".card").filter({ hasText: "Dépenses" }).last();
    await expect(list.locator(".list-item")).toHaveCount(4);

    await page
      .getByRole("searchbox", { name: "Rechercher une dépense par montant, date ou description" })
      .fill("restaurant");
    await expect(list.locator(".list-item")).toHaveCount(1);
    await expect(list.locator(".list-item").first()).toContainText("245,00");
  });

  test("déplier un poste montre sa tendance sur plusieurs mois", async ({ page }) => {
    await expect(page.locator(".trend")).toHaveCount(0);

    await page.locator(".poste__toggle").first().click();
    const trend = page.locator(".trend");
    await expect(trend).toBeVisible();
    // Six months of history, each with a spent value.
    await expect(trend.locator(".trend__row")).toHaveCount(6);
    await expect(trend.locator(".trend__row").last()).toContainText("635,00");
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

  test("l'export CSV produit un fichier daté et non vide", async ({ page }) => {
    await page.goto("fixture.html");
    await openSettings(page);

    // The DOM download plumbing is the one part unit tests cannot reach.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Dépenses (CSV)" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^budget-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");
    expect(csv.split("\r\n")[0]).toBe("Date;Poste;Montant;Qui;Description;Supprimée");
    expect(csv).toContain("Grosses courses");
  });

  test("un profil retiré est hors des sélecteurs mais réactivable", async ({ page }) => {
    await page.goto("fixture.html");
    await openSettings(page);

    const users = page.locator(".card").filter({ hasText: "Utilisateurs" });
    await expect(users.getByText("Colocataire")).toBeVisible();
    await expect(users.getByText("Retiré")).toBeVisible();

    // The retired profile must not be offered when logging an expense.
    await page.getByRole("button", { name: "Retour" }).click();
    await page.getByRole("button", { name: "Ajouter une dépense", exact: true }).click();
    const who = page.locator("#user");
    await expect(who.getByRole("option")).toHaveCount(2);
    await expect(who.getByRole("option", { name: "Colocataire" })).toHaveCount(0);
  });
});
