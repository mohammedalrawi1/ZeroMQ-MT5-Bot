const axios = require("axios");
const cheerio = require("cheerio");
const {
  fetchEconomicEvents,
  CalendarType,
  Country,
  Currency,
  Language,
  Importance,
  TimeZone,
} = require("investing-economic-calendar");
const countries = require("./public/dashboard/assets/countries.json");

class NewsScraper {
  constructor() {
    // this.url = "https://www.myfxbook.com/forex-economic-calendar";
  }

  async getNews() {
    // Example to fetch all important events of today by Countries.
    const eventsWeekly = await fetchEconomicEvents({
      calType: CalendarType.WEEKLY,
      lang: Language.ENGLISH,
      timeZone: TimeZone.BAGHDAD,
    });

    for (let i = 0; i < eventsWeekly.length; i++) {
      const event = eventsWeekly[i];
      try {
        if (event.country == "Euro Zone") {
          event.countryCode = "eu";
        } else {
          let countryObj = countries.filter((obj) => obj.name == event.country);
          event.countryCode = countryObj[0].isoAlpha2.toLowerCase();
        }
      } catch (err) {
        console.log(err);
      }

      if (event.importance) {
        event.importance = event.importance.toString();
        event.importance = event.importance.replace(1, "low");
        event.importance = event.importance.replace(2, "medium");
        event.importance = event.importance.replace(3, "high");
      }
    }

    let final = groupByValue(eventsWeekly);

    function groupByValue(arr) {
      let finalObj = {};
      for (let i = 0; i < arr.length; i++) {
        const event = arr[i];
        if (!finalObj.hasOwnProperty(event.timestampDay)) {
          finalObj[event.timestampDay] = [];
        }
        finalObj[event.timestampDay].push(event);
      }
      return finalObj;
    }
    // console.log(final);
    return final;
  }

  // getNews() {
  //   return new Promise((resolve, reject) => {
  //     // Make an HTTP GET request to fetch the page content using Axios
  //     axios
  //       .get(this.url)
  //       .then((response) => {
  //         if (response.status === 200) {
  //           const htmlData = response.data;

  //           // Load the HTML content into Cheerio for parsing
  //           const $ = cheerio.load(htmlData);

  //           // Select the rows with class "economicCalendarRow"
  //           const rows = $(".economicCalendarRow");

  //           // Initialize an array to store the scraped data
  //           const scrapedData = [];

  //           // Loop through each row
  //           rows.each((index, element) => {
  //             const $row = $(element);

  //             // Extract the desired data from the row
  //             let date = $row
  //               .find(".calendarDateTd")
  //               .attr("data-calendardatetd");
  //             date = new Date(date);
  //             console.log({ date });
  //             let newdate = date.setHours(date.getHours() + 6);
  //             date = new Date(newdate);
  //             console.log({ newDate: date });

  //             let country = "";
  //             let countryCode = "";

  //             // Check if the country element exists in this row
  //             const countryElement = $row.find(".align-center[title]");
  //             if (countryElement.length > 0) {
  //               country = countryElement.attr("title");
  //               let spanFlag = countryElement.find("span");
  //               countryCode = spanFlag
  //                 .attr("class")
  //                 .replace("flag flag-icon-", "")
  //                 .replace("emu", "eu");
  //             }

  //             const currency = $row
  //               .find(".calendarToggleCell:nth-child(4)")
  //               .text()
  //               .trim();
  //             const title = $row.find(".calendar-event-link").text().trim();
  //             console.log({ title });
  //             const impact = $row
  //               .find(".calendarToggleCell:nth-child(6)>div")
  //               .text()
  //               .trim();

  //             // Add the data to the scrapedData array as an object
  //             scrapedData.push({
  //               date,
  //               country,
  //               countryCode,
  //               currency,
  //               title,
  //               impact,
  //             });
  //           });

  //           // return the scraped data
  //           resolve(scrapedData);
  //         }
  //       })
  //       .catch((error) => {
  //         reject(error);
  //       });
  //   });
  // }
}

module.exports = NewsScraper;
