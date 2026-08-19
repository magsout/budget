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

/* `centsToInput` is ungrouped ("6300,00"), so a report field round-trips through
   a plain parse — no locale separators to strip. */
const cents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");

async function openRebalance(page: Page) {
  await page.locator(".account-trigger").click();
  await page.getByRole("button", { name: "Répartition" }).click();
  await expect(page.getByRole("heading", { name: "Répartir le report" })).toBeVisible();
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

  test("chaque journée annonce sa date, son compte et son total", async ({ page }) => {
    await page.goto("fixture.html");

    // Le mois courant du fixture a une dépense par jour, les 02/04/05/06/07.
    const heads = page.locator(".daygroup__head");
    await expect(heads).toHaveCount(5);
    // Plus récent en premier, et le total du jour est une information que
    // l'écran n'affichait nulle part avant.
    await expect(heads.first()).toContainText("7 août");
    await expect(heads.first()).toContainText("1 ligne");
    await expect(heads.first()).toContainText("31,20");
    // Tout est ouvert par défaut : rien n'est caché à l'arrivée.
    await expect(page.locator(".list-item--btn")).toHaveCount(5);
  });

  test("« Tout replier » garde les totaux visibles et n'efface rien en silence", async ({
    page,
  }) => {
    await page.goto("fixture.html");
    const heads = page.locator(".daygroup__head");
    const rows = page.locator(".list-item--btn");

    await page.getByRole("button", { name: "Tout replier" }).click();

    // Les en-têtes restent tous là, chacun avec son total : replier réduit la
    // hauteur, il ne retire pas l'information. Le jour le plus récent reste
    // ouvert — atterrir sur une liste entièrement fermée se lit comme un écran
    // vide.
    await expect(heads).toHaveCount(5);
    await expect(rows).toHaveCount(1);
    await expect(heads.last()).toContainText("42,50");
    // Et le total du mois ne bouge pas.
    const monthCard = page.locator(".card").filter({ hasText: "Dépenses du mois" });
    await expect(monthCard.locator(".card__head-total")).toContainText("250,70");

    // Le mode est mémorisé d'un chargement à l'autre.
    await page.reload();
    await expect(page.getByRole("button", { name: "Tout déplier" })).toBeVisible();
    await expect(rows).toHaveCount(1);

    // Mais une recherche rouvre tout, malgré le mode replié : des boîtes fermées
    // se lisent comme « rien trouvé ».
    await page
      .getByRole("searchbox", { name: "Rechercher une dépense par montant, date ou description" })
      .fill("aout");
    await expect(rows).toHaveCount(5);
    await expect(heads).toHaveCount(5);

    // Et vider la recherche rend la main au mode replié.
    await page
      .getByRole("searchbox", { name: "Rechercher une dépense par montant, date ou description" })
      .fill("");
    await expect(rows).toHaveCount(1);
  });

  test("la répartition par personne totalise chaque profil", async ({ page }) => {
    await page.goto("fixture.html");

    const split = page.locator(".card").filter({ hasText: "Qui a dépensé quoi" });
    const items = split.locator(".stackbar__item");
    await expect(items).toHaveCount(2);
    // Biggest spender first.
    await expect(items.first()).toContainText("Marie");
    await expect(items.first()).toContainText("2 dépenses");
    // A length says nothing to a screen reader, so the bar spells out the shares.
    // `\s` rather than a literal space: fr-FR puts a no-break space before the %.
    await expect(split.getByRole("img")).toHaveAttribute(
      "aria-label",
      /Marie.*61\s%.*Guillaume.*39\s%/s,
    );
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

test.describe("Répartition", () => {
  test("l'écran s'ouvre sans erreur console et porte son sélecteur de mois", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("fixture.html");
    await openRebalance(page);
    // Its own stepper, so a report can be sorted out before the month lands.
    await expect(page.locator(".month-nav")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("le total conservé conditionne l'enregistrement", async ({ page }) => {
    await page.goto("fixture.html");
    await openRebalance(page);

    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    // Nothing touched yet: nothing to save.
    await expect(save).toBeDisabled();

    const fields = page.locator('input[aria-label^="Report ajusté"]');
    const a = fields.nth(0);
    const b = fields.nth(1);
    const aStart = cents(await a.inputValue());
    const bStart = cents(await b.inputValue());

    // Give one poste 100 € it was not owed and take it from nobody: that is
    // money appearing out of nothing, and the screen must refuse to write it.
    await a.fill(euros(aStart + 10000));
    await expect(page.getByText(/Écart de/)).toBeVisible();
    await expect(save).toBeDisabled();

    // Take it off another poste and the books balance — same total, different
    // holder, which is the whole point of the gesture.
    await b.fill(euros(bStart - 10000));
    await expect(page.getByText("Total conservé.")).toBeVisible();
    await expect(save).toBeEnabled();

    // Réinitialiser restores the computed reports.
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(a).toHaveValue(euros(aStart));
    await expect(b).toHaveValue(euros(bStart));
    await expect(save).toBeDisabled();
  });

  test("« Proposer » ne déséquilibre jamais le total", async ({ page }) => {
    await page.goto("fixture.html");
    await openRebalance(page);

    // Whatever the month's figures, a proposal only ever moves what it takes.
    await page.getByRole("button", { name: "Proposer" }).click();
    await expect(page.getByText(/Écart de/)).toHaveCount(0);
    await page.getByRole("button", { name: "Mois précédent" }).click();
    await page.getByRole("button", { name: "Proposer" }).click();
    await expect(page.getByText(/Écart de/)).toHaveCount(0);
  });

  test("les mouvements du mois sont listés et annulables", async ({ page }) => {
    await page.goto("fixture.html");
    await openRebalance(page);
    // The fixture's movements sit on the current month; step back one from the
    // default (next month) to reach them.
    await page.getByRole("button", { name: "Mois précédent" }).click();

    const movements = page.locator(".card", {
      has: page.getByRole("heading", { name: /Mouvements/ }),
    });
    await expect(movements).toBeVisible();
    // Both kinds are named for what they are, not shown as one anonymous figure.
    await expect(movements.getByText("Apport", { exact: false }).first()).toBeVisible();
    await expect(movements.getByRole("button", { name: "Annuler" }).first()).toBeVisible();
  });

  test("un apport se répartit au prorata sans dépasser le pot", async ({ page }) => {
    await page.goto("fixture.html");
    await openRebalance(page);
    await page.getByRole("button", { name: "Mois précédent" }).click();

    const card = page.locator(".card", {
      has: page.getByRole("heading", { name: "Placer un apport" }),
    });
    const save = card.getByRole("button", { name: "Enregistrer" });
    await expect(save).toBeDisabled();

    await card.getByRole("button", { name: "Répartir au prorata" }).click();

    // Each poste gets exactly its shortfall and no more: the surplus stays for
    // the user to place rather than inflating a budget nobody asked to inflate.
    const field = card.locator('input[aria-label^="Apport sur"]').first();
    const need = cents(
      (await card.locator(".mv-row__from").first().textContent())?.replace(/[^\d,-]/g, "") ?? "0",
    );
    expect(cents(await field.inputValue())).toBe(need);
    await expect(card.getByText(/Reste à placer/)).toBeVisible();
    await expect(save).toBeEnabled();

    // Overshooting the pot is refused rather than written.
    await field.fill("99999,00");
    await expect(card.getByText(/de trop/)).toBeVisible();
    await expect(save).toBeDisabled();

    await card.getByRole("button", { name: "Vider" }).click();
    await expect(field).toHaveValue("");
    await expect(save).toBeDisabled();
  });
});

test.describe("Budget › bandeau", () => {
  test("le bandeau annonce le mois qui héritera du report et y mène", async ({ page }) => {
    await page.goto("fixture.html");
    const nudge = page.locator(".card--nudge");
    // Framed on the month that INHERITS the report, not the one showing it: by
    // the time a negative carry-in is on screen the decision is already late.
    await expect(nudge).toContainText("démarrera");
    await expect(nudge).toContainText("dans le rouge");
    await nudge.click();
    await expect(page.getByRole("heading", { name: "Répartir le report" })).toBeVisible();
  });
});

test.describe("Compte", () => {
  test("la cascade compte les apports et marque le revenu ponctuel", async ({ page }) => {
    await page.goto("fixture.html");
    await page.locator(".tabbar").getByRole("button", { name: "Compte" }).click();
    // The one-off is named as such, so a bonus is not read as a salary.
    await expect(page.getByText("ponctuel").first()).toBeVisible();
    // And the bar accounts for money already assigned into the postes.
    await expect(page.locator(".stackbar")).toBeVisible();
  });
});

/*
 * DOM measurements go through `page.evaluate` in its STRING form, as at line 90:
 * tsconfig.node.json gives this project `lib: ["ES2023"]` with no DOM, deliberately
 * (e2e imports nothing from src/). A string expression is evaluated in the page and
 * needs no DOM types here.
 */
const measure = (page: Page, expr: string) => page.evaluate(`(() => (${expr}))()`);

test.describe("Liste par journée · géométrie", () => {
  // These were all SILENT failures: nothing threw, every number was right, the list
  // just read as an undifferentiated ladder. Only measurement catches them.

  test("la bande de l'en-tête affleure les deux bords de la carte", async ({ page }) => {
    await page.goto("fixture.html");
    // `width: 100%` + `margin: 0 -16px` over-constrains the box, so the used value
    // silently drops margin-right and the band stops short on one side only. Dropping
    // the width is not the fix either — a <button> shrink-wraps instead of stretching.
    const gaps = (await measure(
      page,
      `(() => {
        const head = document.querySelector(".daygroup__head");
        const h = head.getBoundingClientRect();
        const c = head.closest(".card").getBoundingClientRect();
        return { left: h.left - c.left, right: c.right - h.right };
      })()`,
    )) as { left: number; right: number };
    expect(Math.abs(gaps.left)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(gaps.right)).toBeLessThanOrEqual(1.5);
  });

  test("la date tient le bord gauche du groupe qu'elle coiffe", async ({ page }) => {
    await page.goto("fixture.html");
    // Behind a caret column the date started 22px deeper than the rows it governs,
    // so it could not read as their anchor.
    const dx = (await measure(
      page,
      `Math.abs(
        document.querySelector(".daygroup__dnum").getBoundingClientRect().left -
        document.querySelector(".xrow").getBoundingClientRect().left
      )`,
    )) as number;
    expect(dx).toBeLessThanOrEqual(2);
  });

  test("le total du jour reste moins fort que les montants des lignes", async ({ page }) => {
    await page.goto("fixture.html");
    // With one row per day the two print the SAME figure a line apart; at equal
    // weight the pair reads as a mistake rather than as a total.
    const sizes = (await measure(
      page,
      `(() => {
        const px = (s) => Number.parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
        return { day: px(".daygroup__total"), row: px(".xrow__amount") };
      })()`,
    )) as { day: number; row: number };
    expect(sizes.day).toBeLessThan(sizes.row);
  });
});

test.describe("Liste par journée · replier", () => {
  test("replier laisse le résultat à l'écran au lieu de faire sauter la page", async ({ page }) => {
    // Folding unmounts day bodies, the document shrinks and the browser clamps the
    // scroll offset: the reader's content used to jump 176px and the tap read as
    // "nothing happened". Preserving scrollY cannot fix that (at the document maximum
    // the shorter page caps the offset), so the list anchors on its own head instead.
    await page.goto("fixture.html");
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(200);

    await page.getByRole("button", { name: "Tout replier" }).click();
    await page.waitForTimeout(700); // smooth scroll settles

    const head = page.locator(".card__head").filter({ hasText: "Dépenses du mois" });
    const box = await head.boundingBox();
    const tab = await page.locator(".tabbar").boundingBox();
    const h = page.viewportSize()?.height ?? 0;

    // On screen, and clear of the floating tab bar that swallows taps down there.
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(Math.min(tab?.y ?? h, h));
    await expect(page.locator(".daygroup__body")).toHaveCount(1);
  });

  test("un en-tête épinglé masque les lignes qui défilent dessous", async ({ page }) => {
    // The sticky header's OPAQUE background is what makes rows disappear behind it.
    // A short viewport is what gives the fixture's list enough travel to pin one.
    await page.setViewportSize({ width: 412, height: 360 });
    await page.goto("fixture.html");
    await page.evaluate(
      `(() => {
        const hs = document.querySelectorAll(".daygroup__head");
        window.scrollTo(0, hs[1].getBoundingClientRect().top + window.scrollY + 24);
      })()`,
    );
    await page.waitForTimeout(300);
    const pinned = (await measure(
      page,
      `(() => {
        const hs = [...document.querySelectorAll(".daygroup__head")];
        const stuck = hs.find((el) => Math.abs(el.getBoundingClientRect().top) < 2);
        if (!stuck) return null;
        const cs = getComputedStyle(stuck);
        return { bg: cs.backgroundColor, z: cs.zIndex, pos: cs.position };
      })()`,
    )) as { bg: string; z: string; pos: string } | null;

    expect(pinned, "no header pinned — the sticky mechanism is not engaging").not.toBeNull();
    expect(pinned?.pos).toBe("sticky");
    expect(pinned?.bg).not.toBe("rgba(0, 0, 0, 0)");
  });
});
