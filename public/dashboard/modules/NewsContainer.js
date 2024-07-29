class NewsContainer {
  constructor({ parent, parentElement }) {
    this.parent = parent;
    this.parentElement = parentElement;
    this.newsBlocks = [];
    this.build();
  }

  build() {
    this.element = this.parentElement.createE("div", "#news-select-container");
    this.newsContainerHead = this.element.createE(
      "div",
      "#news-container-head",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        },
      }
    );
    this.headderElement = this.newsContainerHead.createE(
      "h1",
      "#headder",
      "Economic Calender"
    );
    this.closeBtn = this.newsContainerHead.createE("div", "#news-close-btn", {
      onclick: () => {
        this.hide();
      },
    });
    this.newsTableContainerElement = this.element.createE(
      "div",
      "#news-table-container"
    );
    this.newsTableElement = this.newsTableContainerElement.createE(
      "table",
      "#news-table"
    );
    let tableHeadElement = this.newsTableElement.createE(
      "thead",
      "#news-table-head"
    );
    let tableHeadRowElement = tableHeadElement.createE(
      "tr",
      "#news-table-head-row"
    );
    // setting the table headders names
    tableHeadRowElement.createE("th", "news-table-title", "", {
      style: {
        width: "10%",
      },
    });
    tableHeadRowElement.createE("th", "news-table-title", "time");
    tableHeadRowElement.createE("th", "news-table-title", "country");
    tableHeadRowElement.createE("th", "news-table-title", "currency");
    tableHeadRowElement.createE("th", "news-table-title", "name");
    tableHeadRowElement.createE("th", "news-table-title", "importance");

    this.tableBody = this.newsTableElement.createE("tbody", "#news-table-body");

    let selectorButtonsContainer = this.element.createE(
      "div",
      "#news-selector-button-container"
    );
    let customNewsButton = selectorButtonsContainer.createE(
      "div",
      "#custom-news-button",
      "+ custom news",
      {
        onclick: () => {
          this.addNews({});
        },
      }
    );
    customNewsButton.classList.add("text-button");
    let insertNewsButton = selectorButtonsContainer.createE(
      "div",
      "#insert-news-button",
      "insert",
      {
        onclick: () => {
          let checkboxes = this.newsTableElement.querySelectorAll(
            'input[name="selected"]:checked'
          );
          checkboxes.forEach((checkbox) => {
            let id = parseInt(checkbox.value);
            // this.addNews(this.news[id]);
            this.addNews(this.findNews({ id }));
            checkbox.checked = false;
          });
        },
      }
    );

    this.populateNewsTable();
  }

  async populateNewsTable() {
    let result = await fetch("/news");
    let newsBlocks = await result.json();
    console.log(newsBlocks);

    for (let date in newsBlocks) {
      this.newsBlocks.push(
        new NewsBlock({
          parent: this,
          parentElement: this.tableBody,
          date: date,
          news: newsBlocks[date],
        })
      );
    }
  }

  addNews({ importance, name, country, currency }) {
    if (!this.newsCount) {
      this.newsCount = 0;
    }
    let news = new InputField({
      parent: this.parent.form,
      label: "News",
      name: `newsName-${this.newsCount}`,
      withTypes: ["None", "low", "medium", "high"],
      typesName: `importance-${this.newsCount}`,
      typeValue: importance || "",
      insertBeforeElement: this.parent.addNewsButton,
      options: {
        type: "string",
        placeholder: "News Name",
        value: name || "",
      },
    });
    news.classList.add("first");

    let countryInput = new InputField({
      parent: this.parent.form,
      label: "Country",
      name: `country-${this.newsCount}`,
      withTypes: ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CHF", "CAD"],
      typesName: `currency-${this.newsCount}`,
      typeValue: currency || "",
      insertBeforeElement: this.parent.addNewsButton,
      options: {
        type: "string",
        placeholder: "Country Name",
        value: country || "",
      },
    });

    let inputCloseBtn = this.parent.form.createE("div", "input-close-btn", {
      insertAfterElement: countryInput,
      onclick: (e) => {
        news.remove();
        countryInput.remove();
        e.target.remove();
      },
    });

    this.hide();
    this.newsCount++;
  }

  findNews({ id }) {
    for (let block of this.newsBlocks) {
      let found = block.news.filter((news) => news.id == id);
      if (found.length > 0) {
        found = found[0];
        return {
          importance: found.importance,
          name: found.name.replace(
            /\s\((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\)/gi,
            ""
          ),
          country: found.country,
          currency: found.currency,
        };
      }
    }
  }

  show() {
    this.element.classList.add("active");
  }

  hide() {
    this.element.classList.remove("active");
  }
}
