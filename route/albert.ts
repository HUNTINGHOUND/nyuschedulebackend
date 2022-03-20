import express from "express";
import schedule from "node-schedule";
import webdriver from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
const JSSoup = require("jssoup").default;
const { SoupString } = require("jssoup");
require("dotenv").config({ silent: true });

let selenium_url = process.env.SELENIUM_URL
    ? process.env.SELENIUM_URL
    : "http://seleniumhub:4444/wd/hub";

interface courseInfo {
    [coursename: string]: {
        [attrib: string]: any;
    };
}

interface infoType {
    [term: string]: {
        [schoolname: string]: {
            [major: string]:
            | {
                last_scrapped: number | null;
                courses: any;
            }
            | undefined;
        };
    };
}

const router = express.Router();
const start_url =
    "https://sis.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NYU_SR.NYU_CLS_SRCH.GBL";
let info: infoType = {};

function parsePage(html: string): courseInfo {
    let coursesObj: courseInfo = {};
    let soup = new JSSoup(html);
    const courses = soup.find(undefined, { id: "win0divSELECT_COURSE$0" });
    if (!courses) {
        return coursesObj;
    }

    for (const course of courses.contents) {
        for (let br of course
            .find("div")
            .find("div")
            .find("div")
            .find("span")
            .find("b")
            .findAll("br")) {
            br.replaceWith("\n");
        }

        const courseName: string = course
            .find("div")
            .find("div")
            .find("div")
            .find("span")
            .find("b")
            .getText()
            .trim();
        const courseWhole = course.find("div").find("div").find("div").find("span");
        let courseNote: string;
        if (courseWhole.find("div")) {
            const fullDes = courseWhole.findAll("div")[1].find("p");
            for (let link of fullDes.findAll("a")) {
                link.extract();
            }
            courseNote = fullDes.getText();
        } else {
            courseNote = courseWhole.find("p").getText();
        }

        courseNote = courseNote.replace("\n", " ");
        courseNote = courseNote.trim();
        coursesObj[courseName] = { description: courseNote, classes: [] };

        let classes: any[] = [];
        for (const tag of course.findAll()) {
            if (tag.attrs["id"] && tag.attrs["id"].includes("SELECT_CLASS_row")) {
                classes.push(tag);
            }
        }

        for (const classTag of classes) {
            let classObj: any = {};
            const classInfo = classTag.find("td");
            const classAttrib = classInfo.findAll("div");

            let classNote = classInfo.find("b", undefined, "Notes: ");
            let classNoteStr: string;
            if (classNote) {
                const classNoteParent = classNote.parent;
                classNoteStr = classNoteParent.nextSibling._text;
                classNoteStr = classNoteStr.replace("\n", " ");
                classNoteStr = classNoteStr.trim();
                classObj["Notes"] = classNoteStr;
            }

            const extractor =
                /\d+\/\d+\/\d+ - \d+\/\d+\/\d+ ([A-Za-z,]+) (\d+.\d+ (AM|PM)) - (\d+.\d+ (AM|PM)) at (.+) with (.+)|\d+\/\d+\/\d+ - \d+\/\d+\/\d+ ([A-Za-z,]+) (\d+.\d+ (AM|PM)) - (\d+.\d+ (AM|PM)) with (.+)|\d+\/\d+\/\d+ - \d+\/\d+\/\d+ ([A-Za-z,]+) (\d+.\d+ (AM|PM)) - (\d+.\d+ (AM|PM)) at (.+)|\d+\/\d+\/\d+ - \d+\/\d+\/\d+ ([A-Za-z,]+) (\d+.\d+ (AM|PM)) - (\d+.\d+ (AM|PM))/g;
            let classInstrutors: string[] = [];
            let classWeekdays: string[] = [];
            let classRooms: string[] = [];
            let classTime: string = "";
            for (const classInstructorAndTimeInfo of classInfo.contents) {
                let isString: boolean = false;
                try {
                    classInstructorAndTimeInfo.getText();
                } catch (error) {
                    isString = true;
                }
                if (isString) {
                    const matchInfo = extractor.exec(classInstructorAndTimeInfo._text);
                    let weekdayMatch = "";
                    if (matchInfo) {
                        for (const k of [1, 8, 14, 20]) {
                            if (matchInfo[k]) {
                                weekdayMatch = matchInfo[k];
                            }
                        }

                        let currWeekdays = weekdayMatch.split(",");
                        for (const w of currWeekdays) {
                            if (!(w in classWeekdays)) {
                                classWeekdays.push(w);
                            }
                        }

                        let classTimeMatch1: string = "";
                        for (const k of [2, 9, 15, 21]) {
                            if (matchInfo[k]) {
                                classTimeMatch1 = matchInfo[k];
                            }
                        }

                        let classTimeMatch2: string = "";
                        for (const k of [4, 11, 17, 23]) {
                            if (matchInfo[k]) {
                                classTimeMatch2 = matchInfo[k];
                            }
                        }
                        classTime = classTimeMatch1 + " - " + classTimeMatch2;

                        let classRoomMatch: string | null = null;
                        for (const k of [6, 19]) {
                            if (matchInfo[k]) {
                                classRoomMatch = matchInfo[k];
                            }
                        }

                        if (classRoomMatch != null) {
                            if (!(classRoomMatch in classRooms)) {
                                classRooms.unshift(classRoomMatch);
                            }
                        }

                        let instructorMatch = "";
                        for (const k of [7, 13]) {
                            if (matchInfo[k]) {
                                instructorMatch = matchInfo[k];
                            }
                        }

                        let currInstructors: string[] = [];
                        for (const instructor of instructorMatch.split(";")) {
                            if (instructor != "") {
                                currInstructors.push(instructor.trim());
                            }
                        }

                        for (let instructor of currInstructors) {
                            if (instructor.includes(",")) {
                                let instructorNames: string[] = [];
                                for (const name of instructor.split(",")) {
                                    instructorNames.push(name.trim());
                                }
                                instructor = instructorNames[1] + " " + instructorNames[0];
                            }
                            classInstrutors.push(instructor);
                        }
                    }
                }
            }
            classObj["Instructor"] = classInstrutors;
            classObj["Rooms"] = classRooms;
            classObj["Days/Times"] = `${classWeekdays.join(",")} ${classTime}`;

            for (const attribCollection of classAttrib) {
                let attribs: any[] = [];
                for (const attrib of attribCollection.contents) {
                    if (attrib.name === "div") {
                        attribs.push(attrib);
                    }
                }

                if (attribs.length == 0) {
                    const attribString: string = attribCollection.getText();
                    let attribName = "";
                    let attribValue = "";

                    if (attribString.includes(":")) {
                        attribName = attribString
                            .substring(0, attribString.indexOf(":"))
                            .trim();
                        attribValue = attribString
                            .substring(attribString.indexOf(":") + 1)
                            .trim();
                    } else if (attribString.includes("|")) {
                        attribName = attribString
                            .substring(0, attribString.indexOf("|"))
                            .trim();
                        attribValue = attribString
                            .substring(attribString.indexOf("|") + 1)
                            .trim();
                    } else {
                        attribName = attribString.trim();
                        attribValue = "";
                    }

                    classObj[attribName] = attribValue;
                }
            }
            coursesObj[courseName]["classes"].push(classObj);
        }
    }
    return coursesObj;
}

async function waittoload(driver: webdriver.ThenableWebDriver): Promise<void> {
    const start = Date.now();
    while (true) {
        let element = await driver.findElement(
            webdriver.By.xpath('//img[@id="processing"]')
        );
        const dis = await element.isDisplayed();
        if (!dis || Date.now() - start > 60000) {
            return;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
}

const explorerfunc = async () => {
    console.log("Explorer starts scrapping");

    let driver = new webdriver.Builder()
        .forBrowser("chrome")
        .setChromeOptions(
            new chrome.Options().headless().addArguments("--no-sandbox")
        )
        .usingServer(selenium_url)
        .build();

    let explored_terms: string[] = [];
    await driver.get(start_url);
    for (let i = 0; i < 3; i++) {
        console.log(`Explorer scrapping year ${i + 1}.`);
        let element = await driver.findElement(
            webdriver.By.xpath(`(//div[@class="ps_box-group"])[${i + 1}]//a`)
        );
        await element.click();
        await waittoload(driver);
        console.log(`Explorer year ${i + 1} clicked`);

        const html = await driver.getPageSource();
        const soup = new JSSoup(html);
        const schools = soup.find(undefined, { id: "win0divGROUP$0" });

        let terms: string[] = [];
        const win0tag = soup.find(undefined, {
            id: "win0divNYU_CLS_WRK_TERMS_LBL",
        });
        for (const term_tag of win0tag.findAll("label")) {
            terms.push(term_tag.getText());
        }
        explored_terms.push(...terms);

        for (const term of terms) {
            for (const school of schools.contents) {
                const schoolname: string = school
                    .find("div")
                    .find("h2")
                    .find("span")
                    .getText();
                const schoolmajors: string[] = [];
                for (const major of school.findAll("a")) {
                    schoolmajors.push(major.getText());
                }

                for (const major of schoolmajors) {
                    if (!(term in info)) {
                        info[term] = {};
                    }
                    if (!(schoolname in info[term])) {
                        info[term][schoolname] = {};
                    }

                    if (!info[term][schoolname][major]) {
                        info[term][schoolname][major] = {
                            last_scrapped: null,
                            courses: {},
                        };
                    }
                }
            }
        }
    }

    await driver.quit();
    console.log("Explorer clean up");

    for (const key in info) {
        if (!(key in explored_terms)) {
            const { removed: key, ...removed_info } = info;
            info = removed_info;
        }
    }

    console.log("Explorer finish scrapping");
};

setTimeout(() => explorerfunc(), 10000);

const daily_explorer = schedule.scheduleJob("1 * * *", explorerfunc);

async function getCourses(
    term: string,
    school: string,
    major: string
): Promise<any> {
    if (!info[term] || !info[term][school] || !info[term][school][major]) {
        return {};
    }

    if (
        info[term][school][major]!["last_scrapped"] &&
        Date.now() - info[term][school][major]!["last_scrapped"]! < 300000
    ) {
        return info[term][school][major]!["courses"];
    }

    let driver: webdriver.ThenableWebDriver | undefined = undefined;
    try {
        driver = new webdriver.Builder()
            .forBrowser("chrome")
            .setChromeOptions(
                new chrome.Options().headless().addArguments("--no-sandbox")
            )
            .usingServer(selenium_url)
            .build();

        await driver.get(start_url);

        const term_name = term.substring(0, term.indexOf(" "));
        const term_year = parseInt(term.substring(term.indexOf(" ") + 1));
        for (let i = 0; i < 3; i++) {
            let element = await driver.findElement(
                webdriver.By.xpath(`(//div[@class="ps_box-group"])[${i + 1}]//a`)
            );
            const elementText = await element.getText();
            const first_year = parseInt(
                elementText.substring(0, elementText.indexOf("-"))
            );
            const second_year = parseInt(
                elementText.substring(elementText.indexOf("-") + 1)
            );
            if (
                (term_name === "Fall" && first_year === term_year) ||
                (term_name != "Fall" && second_year === term_year)
            ) {
                await element.click();
                console.log("Thread selected year");
                await waittoload(driver);

                const termSelectedElements = await driver.findElements(
                    webdriver.By.xpath(
                        '//div[@id="win0divNYU_CLS_WRK_TERMS_LBL"]//select'
                    )
                );

                let termSelect: webdriver.WebElement;
                if (term_name === "Fall") {
                    termSelect = termSelectedElements[0];
                } else if (term_name === "January") {
                    termSelect = termSelectedElements[1];
                } else if (term_name === "Spring") {
                    termSelect = termSelectedElements[2];
                } else {
                    termSelect = termSelectedElements[3];
                }

                let termOptions = await termSelect.findElements(
                    webdriver.By.css("option")
                );
                await termOptions[2].click();
                console.log("Thread selected term");
                await waittoload(driver);

                let majorElement: webdriver.WebElement | null;
                if (major.includes("\n")) {
                    try {
                        majorElement = await driver.findElement(
                            webdriver.By.xpath(
                                `//span[text()="${school}"]/../..//*[text()="${major.substring(
                                    0,
                                    major.indexOf("\n")
                                )}"]`
                            )
                        );
                    } catch (error) {
                        majorElement = null;
                    }
                } else {
                    try {
                        majorElement = await driver.findElement(
                            webdriver.By.xpath(
                                `//span[text()="${school}"]/../..//*[text()="${major}"]`
                            )
                        );
                    } catch (error) {
                        majorElement = null;
                    }
                }

                if (majorElement === null) {
                    console.log("Major not found");
                    await driver.quit();
                    return {};
                }

                await majorElement.click();
                console.log("Thread selected major");
                await waittoload(driver);

                const courses = parsePage(await driver.getPageSource());
                if (courses === {}) {
                    await driver.quit();
                    return {};
                }

                info[term][school][major]!["courses"] = courses;
                info[term][school][major]!["last_scrapped"] = Date.now();
                console.log("Added to cache");
                await driver.quit();
                return courses;
            }
        }
        await driver.quit();
        return {};
    } catch (error) {
        if (driver) await driver.quit();
        console.log("Error encountered while getting course");
    }
}

router.get("/getcourse", async (req, res) => {
    const { term, school, major } = req.query;

    if (
        typeof term != "string" ||
        typeof school != "string" ||
        typeof major != "string"
    ) {
        return res.status(422).json({
            errors: "invalid input",
        });
    }

    const info = await getCourses(term, school, major);
    return res.json(info);
});

router.get("/getall", (req, res) => {
    return res.json(info);
});

router.get("/getoptions", (req, res) => {
    let options: any = {};
    for (const term in info) {
        options[term] = {};
        for (const school in info[term]) {
            options[term][school] = Object.keys(info[term][school]).map(
                (major) => major
            );
        }
    }

    return res.json(options);
});

module.exports = router;
