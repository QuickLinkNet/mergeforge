import { describe, expect, it } from 'vitest';

const stylesheets = import.meta.glob('../**/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
// Vite names files of this folder './x.css' and all others '../folder/x.css'.
const TOKENS_PATH = './tokens.css';
const tokens = stylesheets[TOKENS_PATH] ?? '';
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const defined = new Set([...tokens.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]));
const componentSheets = Object.entries(stylesheets).filter(([path]) => path !== TOKENS_PATH);

describe('design system', () => {
  it('finds the tokens and the component stylesheets', () => {
    expect(defined.size).toBeGreaterThan(100);
    expect(componentSheets.length).toBeGreaterThan(20);
  });

  it('uses only raw values from tokens.css in every other stylesheet', () => {
    const offenders: string[] = [];
    for (const [path, css] of componentSheets) {
      // Breakpoints cannot use custom properties, so @media conditions are exempt (see README).
      const body = withoutComments(css).replace(/@media[^{]*\{/g, '{');
      for (const match of body.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b\d+(?:\.\d+)?px\b/g)) {
        offenders.push(`${path}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('defines every token a stylesheet refers to', () => {
    const missing: string[] = [];
    for (const [path, css] of Object.entries(stylesheets)) {
      for (const match of css.matchAll(/var\((--[\w-]+)/g)) {
        if (!defined.has(match[1])) missing.push(`${path}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps every stylesheet below 500 lines', () => {
    const long = Object.entries(stylesheets)
      .map(([path, css]) => [path, css.split('\n').length] as const)
      .filter(([, lines]) => lines >= 500);
    expect(long).toEqual([]);
  });
});
