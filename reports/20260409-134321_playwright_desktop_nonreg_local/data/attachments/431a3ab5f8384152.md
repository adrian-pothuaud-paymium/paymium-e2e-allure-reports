# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation/in-app/web-navbar.spec.ts >> Un utilisateur peut naviguer vers les principales sections du site via la barre de navigation
- Location: tests/navigation/in-app/web-navbar.spec.ts:10:5

# Error details

```
TimeoutError: locator.click: Timeout 60000ms exceeded.
Call log:
  - waiting for getByTestId('marketSearch').getByRole('link', { name: /Parrainage|Referral/ })
    - locator resolved to <a role="link" tabindex="0" href="/referral" data-testid="nav.application.referral" class="css-g5y9jx r-1loqt21 r-1otgn73 hover:background-color-[var(--colors-background-hover)] active:background-color-[var(--colors-background-active)] padding-top-[var(--space-md)] padding-bottom-[var(--space-md)] padding-left-[var(--space-md)] padding-right-[var(--space-md)] gap-[var(--space-md)] align-items-[center] border-radius-[4px] flex-direction-[column] justify-content-[center] width-[78px] lg:flex-direct…>…</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="needsclick"></div> from <div data-nosnippet="" id="axeptio_overlay" class="axeptio_mount" data-project-id="66d9b297fede9a4cae0fdd4a">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="needsclick"></div> from <div data-nosnippet="" id="axeptio_overlay" class="axeptio_mount" data-project-id="66d9b297fede9a4cae0fdd4a">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```