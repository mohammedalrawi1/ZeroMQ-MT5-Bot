class NewsBlock {
  constructor({ parent, parentElement, date, news }) {
    this.parent = parent;
    this.parentElement = parentElement;
    this.date = date;
    this.news = news; // array of news within the date
    this.build();
  }

  build() {
    this.row = this.parentElement.createE(
      "tr",
      `news-table-row ${this.importance}`
    );
    this.dateElement = this.row.createE("td", "news-table-date", this.date, {
      colSpan: 6,
    });
    this.news.map((block) => {
      return new NewsItem({
        parent: this,
        parentElement: this.parentElement,
        country: block.country,
        countryCode: block.countryCode,
        currency: block.currency,
        id: block.id,
        importance: block.importance,
        time: block.time,
        name: block.name,
      });
    });
  }
}
