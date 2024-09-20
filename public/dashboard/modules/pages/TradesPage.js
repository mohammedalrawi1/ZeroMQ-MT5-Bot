class TradesPage extends Page {
  constructor() {
    super();
    this.trades = {};
  }

  build() {
    this.element = this.parentElement.createE("div", "page");

    // this.element.innerHTML = `
    // <h1>New Trade</h1>
    // <form action="/trade" method="post" id="trade-form" required>
    //   <div class="input-container">
    //     <select class="input symbol" name="symbol">
    //       <option value="XAUUSD.c">XAUUSD.c</option>
    //       <option value="EURUSD.c">EURUSD.c</option>
    //     </select>
    //     <label class="label">symbol: </label>
    // </div>

    // <div class="input-container">
    //   <input class="input" type="datetime-local" name="virtualTime" required>
    //   <label class="label">Time: </label>
    // </div>

    // <div class="input-container" id="margin-input">
    //   <input class="input" type="number" placeholder="60" name="marginPercentage" required>
    //   <label class="label">Margin: </label>
    // </div>

    // <div class="input-container with-type">
    //   <input class="input" type="number" placeholder="10" name="maximumLoss" required>
    //   <label class="label">Maximum Loss: </label>
    //     <select class="input" name="maximumLossType">
    //         <option value="%">%</option>
    //         <option value="$">$</option>
    //         <option value="pips">pips</option>
    //     </select>
    // </div>

    // <div class="input-container" id="gap-input">
    //   <input class="input" type="number" placeholder="5" name="gap" required>
    //   <label class="label">Gap: </label>
    // </div>

    // <div class="input-container">
    //   <input class="input" type="number" placeholder="3" name="trailingMinutes" required>
    //   <label class="label">Trailing Minutes: </label>
    // </div>

    // <div class="input-container" id="timeout-input">
    //   <input class="input" type="number" placeholder="30" name="timeout" required>
    //   <label class="label">Timeout: </label>
    // </div>

    // <div class="input-container" id="partialClosePercentage-input">
    //   <input class="input" type="number" placeholder="50" name="partialCloseAmount" required>
    //   <label class="label">Partial Close: Close </label>
    // </div>

    // <div class="input-container with-type">
    //   <input class="input" name="partialCloseTarget" type="number" required>
    //   <label class="label">when it hits: </label>
    //   <select class="input" name="partialCloseType">
    //     <option value="$">$</option>
    //     <option value="pips">pips</option>
    //   </select>
    // </div>

    // <input class="submit" type="submit" value="submit">

    // </form>
    // `

    this.titleElement = this.element.createE("h1", "page-title", "New Trade");

    this.form = this.element.createE("form", "#trade-form", {
      method: "POST",
      action: "/trade",
    });

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      let formData = new FormData(this.form);
      console.log("Sent Data: ");

      let jsonData = {};
      jsonData.news = [];

      for (let obj of formData) {
        // check if the obj is a properity of news
        let newsPattern = new RegExp(/country|currency|importance|newsName/g);
        if (newsPattern.test(obj[0])) {
          let splitted = obj[0].split("-");
          console.log(obj);
          let newsKey = splitted[0];
          let index = splitted[1];
          if (!jsonData.news[index]) {
            jsonData.news[index] = {};
          }
          jsonData.news[index][newsKey] = obj[1];
        } else {
          jsonData[obj[0]] = obj[1];
        }
      }
      console.log("Table Data:");
      console.log(jsonData);

      fetch("/trade", {
        method: "POST",
        body: JSON.stringify(jsonData),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (!response.ok) {
          console.log("error while recieving a response");
        }
        app.getTrades();
        console.log(response.json());
      });
    });

    this.symbol = new InputField({
      parent: this.form,
      name: "symbol",
      label: "symbol",
      options: {
        type: "select",
        values: [
          "EURUSD#",
          "GOLD#",
          "USDJPY#",
          "GBPUSD#",
          "EURGBP#",
          "AUDUSD#",
          "USDCAD#",
          "USDCHF#",
          "NZDUSD#",
          "GBPJPY#",
          "OILCash",
        ],
      },
    });

    this.time = new InputField({
      parent: this.form,
      name: "virtualTime",
      label: "Time",
      options: {
        type: "datetime-local",
        value: new Date().dateTimeString(),
      },
    });

    this.marginPercentage = new InputField({
      parent: this.form,
      label: "Maximum Margin",
      name: "marginPercentage",
      options: {
        type: "number",
        placeholder: 60,
        value: 80,
      },
    });

    this.slOffset = new InputField({
      parent: this.form,
      label: "SL Offset",
      name: "slOffset",
      options: {
        type: "number",
        placeholder: 60,
        value: 70,
      },
    });

    this.maximumLoss = new InputField({
      parent: this.form,
      name: "maximumLoss",
      label: "Maximum Loss",
      withTypes: ["$", "%", "pips"],
      options: {
        type: "number",
        placeholder: 10,
        value: 10,
      },
      typeValue: "%",
    });

    this.gap = new InputField({
      parent: this.form,
      label: "Gap",
      name: "gap",
      withTypes: ["average", "pips"],
      options: {
        type: "float",
        placeholder: 5,
        value: 1.5,
      },
      typeValue: "average",
    });

    this.trailingMinutes = new InputField({
      parent: this.form,
      label: "Trailing Minutes",
      name: "trailingMinutes",
      options: {
        type: "number",
        placeholder: 3,
        value: 3,
      },
    });

    this.timeout = new InputField({
      parent: this.form,
      label: "Timeout",
      name: "timeout",
      options: {
        type: "number",
        placeholder: 80,
        value: 30,
      },
    });

    this.addNewsButton = this.form.createE(
      "div",
      "text-button first",
      "+ Add News",
      {
        onclick: () => {
          this.showNews();
        },
      }
    );

    this.partialClosePercentage = new InputField({
      parent: this.form,
      label: "Close",
      name: "partialClosePercentage",
      options: {
        type: "number",
        placeholder: 50,
        value: 50,
      },
    });
    this.partialClosePercentage.classList.add("first");

    this.partialCloseTarget = new InputField({
      parent: this.form,
      label: "When it hits",
      name: "partialCloseTarget",
      withTypes: ["%", "$", "pips"],
      options: {
        type: "number",
        placeholder: 50,
        value: 250,
      },
      typeValue: "%",
    });

    this.form.createE("input", "submit", {
      type: "submit",
      value: "submit",
    });

    this.pendingTradesContainer = new TradeContainer("Pending Trades", this);

    this.executedTradesContainer = new TradeContainer("Executed Trades", this);

    this.runningTradesContainer = new TradeContainer("Running Trades", this);

    this.built = true;
    // this.populateNewsTable();
    this.newsElement = new NewsContainer({
      parent: this,
      parentElement: this.element,
    });
  }

  // // a method to add a news from the news selector
  // addNews({ importance, Element, country, currency }) {
  //   if (!this.newsCount) {
  //     this.newsCount = 0;
  //   }
  //   let news = new InputField({
  //     parent: this.form,
  //     label: "News",
  //     name: `newsElement-${this.newsCount}`,
  //     withTypes: ["None", "Low", "Medium", "High"],
  //     typesName: `importance-${this.newsCount}`,
  //     typeValue: importance || "",
  //     insertBeforeElement: this.addNewsButton,
  //     options: {
  //       type: "string",
  //       placeholder: "News Element",
  //       value: Element || "",
  //     },
  //   });

  //   news.classList.add("first");

  //   let countryinput = new InputField({
  //     parent: this.form,
  //     label: "Country",
  //     name: `country-${this.newsCount}`,
  //     withTypes: ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CHF"],
  //     typesName: `currency-${this.newsCount}`,
  //     typeValue: currency || "",
  //     insertBeforeElement: this.addNewsButton,
  //     options: {
  //       type: "string",
  //       placeholder: "Country Name",
  //       value: country || "",
  //     },
  //   });

  //   this.hideNews();
  //   this.newsCount++;
  // }

  hideNews() {
    this.newsElement.hide();
  }

  showNews() {
    this.newsElement.show();
  }

  // async populateNewsTable() {
  //   let result = await fetch("/news");
  //   this.news = await result.json();
  //   console.log(this.news);
  //   this.newsSelectContainer = this.element.createE(
  //     "div",
  //     "#news-select-container"
  //   );
  //   let newsTableContainer = this.newsSelectContainer.createE(
  //     "div",
  //     "#news-table-container"
  //   );
  //   this.newsTable = newsTableContainer.createE("table", "#news-table");
  //   let tableHead = this.newsTable.createE("thead", "#news-table-head");
  //   let tableHeadRow = tableHead.createE("tr", "#news-table-head-row");
  //   // setting the table headders names
  //   tableHeadRow.createE("th", "news-table-Element", "");
  //   tableHeadRow.createE("th", "news-table-Element", "time");
  //   tableHeadRow.createE("th", "news-table-Element", "country");
  //   tableHeadRow.createE("th", "news-table-Element", "currency");
  //   tableHeadRow.createE("th", "news-table-Element", "Element");
  //   tableHeadRow.createE("th", "news-table-Element", "importance");

  //   let tableBody = this.newsTable.createE("tbody", "#news-table-body");

  //   for (let date in this.news) {
  //     let dateElement = tableBody.createE("tr", "news-table-date", date);
  //     for (let i = 0; i < this.news[date].length; i++) {
  //       let row = tableBody.createE(
  //         "tr",
  //         `news-table-row ${this.news[date][i].importance}`
  //       );

  //       // checkbox
  //       let checkboxContainer = row.createE("td", "checkbox-container");
  //       let checkbox = checkboxContainer.createE(
  //         "input",
  //         "news-table-data checkbox",
  //         {
  //           type: "checkbox",
  //           name: "selected",
  //           value: i,
  //         }
  //       );

  //       let time = row.createE(
  //         "td",
  //         "news-table-data time",
  //         this.news[date][i].time
  //       );
  //       let country = row.createE("td", "news-table-data country");
  //       let countryFlag = country.createE(
  //         "img",
  //         "country-flag",
  //         `https://flagicons.lipis.dev/flags/4x3/${this.news[date][i].countryCode}.svg`,
  //         {
  //           width: 25,
  //           Element: this.news[date][i].country,
  //         }
  //       );
  //       let currency = row.createE(
  //         "td",
  //         "news-table-data currency",
  //         this.news[date][i].currency
  //       );
  //       let name = row.createE(
  //         "td",
  //         "news-table-data name",
  //         this.news[date][i].name
  //       );
  //       let importance = row.createE(
  //         "td",
  //         "news-table-data importance",
  //         this.news[date][i].importance
  //       );
  //     }
  //   }
  //   let selectorButtonsContainer = this.newsSelectContainer.createE(
  //     "div",
  //     "#news-selector-button-container"
  //   );
  //   let customNewsButton = selectorButtonsContainer.createE(
  //     "div",
  //     "#custom-news-button",
  //     "+ custom news",
  //     {
  //       onclick: () => {
  //         this.addNews({});
  //       },
  //     }
  //   );
  //   customNewsButton.classList.add("text-button");
  //   let insertNewsButton = selectorButtonsContainer.createE(
  //     "div",
  //     "#insert-news-button",
  //     "insert",
  //     {
  //       onclick: () => {
  //         let checkboxes = this.newsTable.querySelectorAll(
  //           'input[name="selected"]:checked'
  //         );
  //         checkboxes.forEach((checkbox) => {
  //           let dataIndex = parseInt(checkbox.value);
  //           this.addNews(this.news[dataIndex]);
  //           checkbox.checked = false;
  //         });
  //       },
  //     }
  //   );
  // }
}
