class NavBar {
  constructor(parent) {
    this.parent = parent;
    this.buttons = [];
    this.build();
  }

  build() {
    this.element = this.parent.createE("div", "#nav-bar");

    this.logoContainer = this.element.createE("div", "#logo-container", "BOT");

    this.onlineStatus = this.logoContainer.createE("div", "#online-status", {
      className: "online",
    });

    let tradesBtn = this.addButton({
      title: "Trades",
      page: new TradesPage(),
    });

    let historyBtn = this.addButton({
      title: "History",
      page: new HistoryPage(),
    });

    this.userButton = new User(username, this.element);
  }

  addButton(obj) {
    app.pages[obj.title] = obj.page;
    this.buttons.push(new NavButton({ ...obj, parent: this }));
  }
}
