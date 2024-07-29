class User {
  constructor(username, parent) {
    this.username = username;
    this.parent = parent;

    this.build();
  }

  build() {
    this.element = this.parent.createE('div', 'nav-button', this.username)
    this.element.addEventListener('click', () => this.logout())
  }

  logout() {
    fetch('/logout')
  }
}