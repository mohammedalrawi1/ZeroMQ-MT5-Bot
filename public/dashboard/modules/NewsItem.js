class NewsItem {
  constructor({
    parent,
    parentElement,
    country,
    countryCode,
    currency,
    id,
    importance,
    time,
    name,
  }) {
    this.parent = parent;
    this.parentElement = parentElement;
    this.country = country;
    this.countryCode = countryCode;
    this.currency = currency;
    this.id = id;
    this.importance = importance;
    this.time = time;
    this.name = name;
    this.build();
  }

  build() {
    this.row = this.parentElement.createE(
      "tr",
      `news-table-row ${this.importance}`
    );

    // checkbox
    this.checkboxContainer = this.row.createE("td", "checkbox-container");
    this.checkboxElement = this.checkboxContainer.createE(
      "input",
      "news-table-data checkbox",
      {
        type: "checkbox",
        name: "selected",
        value: this.id,
      }
    );

    this.timeElement = this.row.createE(
      "td",
      "news-table-data time",
      this.time
    );
    this.countryElement = this.row.createE("td", "news-table-data country");
    this.countryFlagElement = this.countryElement.createE(
      "img",
      "country-flag",
      `https://flagicons.lipis.dev/flags/4x3/${this.countryCode}.svg`,
      {
        width: 25,
        title: this.country,
      }
    );
    this.currencyElement = this.row.createE(
      "td",
      "news-table-data currency",
      this.currency
    );
    this.nameElement = this.row.createE(
      "td",
      "news-table-data name",
      this.name
    );
    this.importanceElement = this.row.createE(
      "td",
      "news-table-data importance",
      this.importance
    );
  }
}
