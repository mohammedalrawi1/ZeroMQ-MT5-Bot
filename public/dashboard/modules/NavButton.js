class NavButton {
  constructor({ title, parent, page }) {
    this.title = title;
    this.parent = parent;
    this.page = page;

    this.build();
  }

  build() {
    this.element = this.parent.element.createE("div", "nav-button", this.title);
    this.element.addEventListener("click", () => this.onClick());
  }

  onClick() {
    this.activate();
    this.page.activate();
  }

  activate() {
    app.navBar.buttons.forEach((b) => b.deactivate());
    this.element.classList.add("active");
  }

  deactivate() {
    this.element.classList.remove("active");
  }

  createPage(container) {
    this.page.updateParentElement(container);
    this.page.build();
  }
}
