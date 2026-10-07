/**
 * What Obsidian adds to every window it opens, for the jsdom ones the tests
 * draw in: `doc` and `win` on each node, the element helpers `createEl`,
 * `createDiv` and `createSpan` on each node and as globals of the window, and
 * `createFragment`.
 *
 * A window has a `Node` of its own, so each window a test draws in is given
 * them with `installObsidianDom`. `jest.config.js` does it for the one the
 * tests run in. Only what the plugin and its tests use is here: `cls`, `text`
 * and `attr` of the element info.
 */

interface ElementInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
}

type Info = ElementInfo | string;

const build = (doc: Document, tag: string, info?: Info): HTMLElement => {
  const element = doc.createElement(tag);
  const { cls, text, attr } =
    typeof info === "string" ? { cls: info } : (info ?? {});

  if (cls !== undefined) {
    element.classList.add(...(typeof cls === "string" ? [cls] : cls));
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  for (const [name, value] of Object.entries(attr ?? {})) {
    if (value !== null) {
      element.setAttribute(name, String(value));
    }
  }

  return element;
};

/** The document a node draws in: its own, or the node is the document. */
const documentOf = (node: Node): Document =>
  node.ownerDocument ?? (node as Document);

export const installObsidianDom = (win: Window): void => {
  const scope = win as typeof window;
  const { Node: WindowNode } = scope;
  const helpers = {
    createEl: (doc: Document, tag: string, info?: Info) =>
      build(doc, tag, info),
    createDiv: (doc: Document, info?: Info) => build(doc, "div", info),
    createSpan: (doc: Document, info?: Info) => build(doc, "span", info),
  };

  Object.defineProperties(WindowNode.prototype, {
    doc: {
      configurable: true,
      get(this: Node) {
        return this.ownerDocument;
      },
    },
    win: {
      configurable: true,
      get(this: Node) {
        return this.ownerDocument?.defaultView;
      },
    },
    createEl: {
      configurable: true,
      value(this: Node, tag: string, info?: Info) {
        return this.appendChild(helpers.createEl(documentOf(this), tag, info));
      },
    },
    createDiv: {
      configurable: true,
      value(this: Node, info?: Info) {
        return this.appendChild(helpers.createDiv(documentOf(this), info));
      },
    },
    createSpan: {
      configurable: true,
      value(this: Node, info?: Info) {
        return this.appendChild(helpers.createSpan(documentOf(this), info));
      },
    },
  });

  Object.assign(scope, {
    createEl: (tag: string, info?: Info) =>
      helpers.createEl(scope.document, tag, info),
    createDiv: (info?: Info) => helpers.createDiv(scope.document, info),
    createSpan: (info?: Info) => helpers.createSpan(scope.document, info),
    createFragment: () => scope.document.createDocumentFragment(),
  });
};
