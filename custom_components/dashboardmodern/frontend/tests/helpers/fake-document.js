/* Un documento finto, quel tanto che basta ai disegnatori.
 *
 * Stava dentro una prova sola. Serve anche alle altre che disegnano l'editor
 * Energia senza browser, e copiarlo avrebbe voluto dire tenerne due allineati
 * a mano: sta qui, e chi lo usa lo chiama.
 */

class ClassList {
  constructor(node) {
    this.node = node;
  }
  add(...names) {
    const set = new Set(this.node.className.split(/\s+/).filter(Boolean));
    names.forEach((n) => set.add(n));
    this.node.className = [...set].join(" ");
  }
  toggle(name, force) {
    const set = new Set(this.node.className.split(/\s+/).filter(Boolean));
    force ? set.add(name) : set.delete(name);
    this.node.className = [...set].join(" ");
  }
  contains(name) {
    return this.node.className.split(/\s+/).includes(name);
  }
}
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.listeners = {};
    this.hidden = false;
  }
  append(...nodes) {
    this.children.push(...nodes);
    nodes.forEach((n) => {
      n.parentElement = this;
    });
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  click() {
    this.listeners.click?.();
  }
  set innerHTML(value) {
    this._html = value;
  }
  get innerHTML() {
    return this._html || "";
  }
  queryAll(predicate, out = []) {
    if (predicate(this)) out.push(this);
    this.children.forEach((c) => c.queryAll?.(predicate, out));
    return out;
  }
}
export { ClassList, Element };

/** Un documento e una radice su cui disegnare. */
export function creaDocumentoFinto() {
  return { document: { createElement: (tag) => new Element(tag) }, root: new Element("div") };
}
