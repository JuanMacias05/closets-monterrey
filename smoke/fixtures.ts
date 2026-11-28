import { expect, test as base } from "@playwright/test";

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// IMPORTANT: this suite runs against production. Every request the browser tries that could
// write (a server action, the search-terms POST, a favorite) is aborted before it leaves, and
// the test fails so the write that slipped in gets noticed instead of silently skipped. Uncaught
// JavaScript errors fail the test too: a page can return 200 and still be broken.
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const writes: string[] = [];
      const pageErrors: string[] = [];

      await page.route("**/*", (route) => {
        const request = route.request();
        if (READ_ONLY_METHODS.has(request.method())) return route.continue();
        writes.push(`${request.method()} ${request.url()}`);
        return route.abort("blockedbyclient");
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await use();

      expect(writes, "requests that would write to production").toEqual([]);
      expect(pageErrors, "uncaught JavaScript errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
