import express from 'express';
import axios from 'axios';
const JSSoup = require('jssoup').default;
const router = express.Router();

interface cacheType {
    [prof_name: string]: {
        last_scrapped: number,
        info: any
    }
}

const sid = 675;
const cache:cacheType = {};
const rmplink = "http://www.ratemyprofessors.com";

async function rmpsearch(prof_name:string):Promise<string> {
    const params = `query=${prof_name}&sid=${sid}`;
    const res = await axios.get(rmplink + "/search/teachers?" + params);
    if (res.status != 200) {
        console.log('rmpsearch failed', res.status);
        return '';
    }

    return res.data;
}

async function parseprof(tid:number):Promise<string> {
    const res = await axios.get(rmplink + `/ShowRatings.jsp?tid=${tid}`);
    if (res.status != 200) {
        console.log('parseprof failed', res.status);
        return '';
    }
    return res.data;
}

async function findProf(prof_name:string):Promise<any> {
    let prof:any = {};
    if (prof_name in cache && Date.now() - cache[prof_name]['last_scrapped'] < 432000000) {
        return cache[prof_name]['info'];
    }

    if (prof_name.length == 0 || prof_name === 'Staff') {
        return prof;
    }

    const html_doc = await rmpsearch(prof_name);
    const data = [...html_doc.matchAll(/"legacyId":(\d+)/g)];
    if (data.length > 0) {
        prof['tid'] = parseInt(data[0][1]);
        prof['url'] = 'www.ratemyprofessors.com/ShowRatings.jsp?tid=' + prof['tid'];
    } else {
        return prof;
    }

    const html_prof = await parseprof(prof['tid']);
    const soup = new JSSoup(html_prof);

    let tags:any[] = [];
    for (const tag of soup.findAll()) {
        if (tag.attrs['class']) {
            if (tag.attrs['class'].includes('RatingValue__Numerator') ||
            tag.attrs['class'].includes('FeedbackItem__FeedbackNumber') ||
            tag.attrs['class'].includes('TeacherTags__TagsContainer')) {
                tags.push(tag);
            }
        } else if(tag.name === "a") {
            if (/https:\/\/www.ratemyprofessors.com\/campusRatings.jsp\?sid=/g.exec(tag.attrs['href'])) {
                tags.push(tag);
            }
        }
    }

    for (const tag of tags) {
        if (tag.name === "a") {
            if (tag.attrs['href'] != "https://www.ratemyprofessors.com/campusRatings.jsp?sid=675") {
                console.log("abandon", tag.attrs['href']);
                return {};
            }
        } else if(tag.attrs['class'].includes('FeedbackItem__FeedbackNumber')) {
            prof[tag.nextSibling.string._text] = tag.string._text;
        } else if(tag.attrs['class'].includes('RatingValue__Numerator')) {
            prof['Rating'] = `${tag.string._text} / 5`;
            if (tag.string === 'N/A') {
                prof['Rating'] = 'N/A';
            }
        } else {
            prof['Tags'] = [];
            for (const cat of tag.contents) {
                prof['Tags'].push(cat.string._text);
            }
        }
    }

    cache[prof_name] = {last_scrapped: Date.now(), info: prof};
    return prof;

}

router.get('/getProf', async (req, res) => {
    const {
        name
    } = req.query;


    if (!name || typeof name != 'string') {
        return res.status(422).json({
            errors: 'professor name is required'
        });
    }

    const data = await findProf(name);
    return res.json(data);
});



module.exports = router;