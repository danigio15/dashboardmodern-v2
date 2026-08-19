/* Which builds a browser test runs against.
 *
 * The dashboard ships as two documents, Italian and English. They are the same
 * document: 1365 tags, 453 ids, identical in both — what differs is the words
 * in them and which runtime file they load. A test that reads the DOM and
 * asserts a contract therefore proves exactly the same thing twice when it runs
 * on both, and that duplication was a third of the browser suite's wall clock.
 *
 * - VARIANTS is for tests that are about the words: they branch on the language
 *   and assert what each build says.
 * - SMOKE keeps one broad path over the English build, so a divergence in its
 *   runtime — the half that is not shared — still has somewhere to show.
 * - PRIMARY is for everything else: the contract is language independent, so it
 *   is proved once.
 */
export const VARIANTS = ["dashboard.html", "dashboard-en.html"];
export const SMOKE = VARIANTS;
export const PRIMARY = ["dashboard.html"];
