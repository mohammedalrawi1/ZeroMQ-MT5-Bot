class Page {
  constructor(navButton, parent, title) {
    this.navButton = navButton;
    this.parent = parent;
    this.title = title;

    this.built = false;
  }

  activate() {
    if (!this.built) {
      this.build();
    }
    app.navBar.buttons.forEach((p) => p.page.deactivate());
    this.element.classList.add("active");
  }

  deactivate() {
    console.log("deactivated", this);
    this.element.classList.remove("active");
  }

  reload() {
    this.element.remove();
    this.build();
  }

  updateParentElement(parentElement) {
    this.parentElement = parentElement;
  }
}
