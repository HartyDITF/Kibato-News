import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK = process.env.DISCORD_WEBHOOK;



const parser = new Parser({

customFields:{
item:[
["content:encoded","contentEncoded"],
["media:content","media"],
["media:thumbnail","thumbnail"]
]
}

});



const feeds = [

"https://animecorner.me/feed/"

];



let sent = [];

let posterRequests = 0;

let videoRequests = 0;



if(fs.existsSync("sent.json")){

try{

sent = JSON.parse(
fs.readFileSync("sent.json","utf8")
);

}catch{

sent=[];

}

}





// Фильтр мусора

function badNews(text){


const bad = [

"game",
"controller",
"figure",
"merch",
"podcast",
"interview",
"review",
"column",
"opinion",
"concert",
"event",
"marine day",

"manga",
"novel",
"light novel",

"live action",


"birthday",
"wedding",
"marriage",
"husband",
"wife",
"baby",
"child",
"birth",
"born",
"pregnant",
"pregnancy",
"family",
"personal",
"anniversary",
"death",
"funeral"

];


text=text.toLowerCase();


return bad.some(word =>
text.includes(word)
);

}







// Проверяем что это именно аниме-новость

function isAnimeNews(text){


const good=[

"anime",
"season",
"film",
"trailer",
"visual",
"cast",
"staff",
"premiere",
"adaptation",
"announced",
"reveals",
"release",
"production",
"studio",
"voice actor",
"voice actress"

];


text=text.toLowerCase();



return good.some(word =>
text.includes(word)
);


}








async function translate(text){


if(!text)
return "";



try{


const clean =
text
.replace(/\s+/g," ")
.trim()
.substring(0,3000);



const r = await axios.get(

"https://translate.googleapis.com/translate_a/single",

{

params:{

client:"gtx",
sl:"en",
tl:"ru",
dt:"t",
q:clean

}

}

);



return r.data[0]
.map(x=>x[0])
.join("");



}catch{


return text;

}


}









function cleanText(text){


if(!text)
return "";



return text

.replace(/<script[\s\S]*?<\/script>/gi,"")

.replace(/<style[\s\S]*?<\/style>/gi,"")

.replace(/<[^>]*>/g,"")

.replace(/facebook|twitter|pinterest|reddit|whatsapp/gi,"")

.replace(/Also Read[\s\S]*/gi,"")

.replace(/Также прочитайте[\s\S]*/gi,"")

.replace(/Previous Post[\s\S]*/gi,"")

.replace(/Next Post[\s\S]*/gi,"")

.replace(/Комментарии[\s\S]*/gi,"")

.replace(/Loading[\s\S]*/gi,"")

.replace(/Источник:[\s\S]*/gi,"")

.replace(/Source:[\s\S]*/gi,"")

.replace(/Written by[\s\S]*/gi,"")

.replace(/Автор:[\s\S]*/gi,"")

.replace(/&nbsp;/g," ")

.replace(/&amp;/g,"&")

.replace(/\s+/g," ")

.trim();

}










function makeShort(text){


let clean =
cleanText(text);



if(!clean)
return "";



// убираем слишком короткие куски

let sentences =
clean
.split(".")
.filter(x =>
x.trim().length>40
);



let result =
sentences
.slice(0,5)
.join(". ")
.trim();



if(result.length>1200){

result =
result.substring(0,1200)
+"...";

}



return result;

}



async function getData(item){

let image=null;
let description="";
let video=null;
let html="";


// Берём картинку из RSS

if(item.media?.$?.url){

image=item.media.$.url;

}


if(!image && item.thumbnail?.$?.url){

image=item.thumbnail.$.url;

}




// Берём описание из RSS

description =
item.contentSnippet ||
item.contentEncoded ||
"";





try{


const page =
await axios.get(
item.link,
{
headers:{
"User-Agent":"Mozilla/5.0"
},
timeout:8000
}
);

html = page.data;

const $ = cheerio.load(page.data);





// OG картинка

if(!image){

image =
$('meta[property="og:image"]')
.attr("content");

}




// Twitter картинка

if(!image){

image =
$('meta[name="twitter:image"]')
.attr("content");

}




// Первая картинка статьи

if(!image){

image =
$("article img")
.first()
.attr("src");

}






// Если RSS описание плохое

if(needArticleText(description)){

    const articleText =
    $("article p")
    .map((i,e)=>$(e).text().trim())
    .get()
    .filter(t => t.length > 40)
    .slice(0,6)
    .join(" ");

    if(articleText.length > description.length){

        description = articleText;

    }

}




}catch(e){


console.log(
"Ошибка страницы:",
e.message
);


}





const yt =
html.match(
/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]+/
);


if(yt){

video=yt[0];

}





return {

image,

description:
makeShort(description),

video

};

}



function needArticleText(description){

    if(!description) return true;

    description = cleanText(description);

    // слишком короткое описание
    if(description.length < 1000)
        return true;

    // обрезано на середине предложения
    if(!/[.!?]$/.test(description))
        return true;

    // обрезано многоточием
    if(description.endsWith("..."))
        return true;

    return false;
}






// Получение постера через Jikan
// максимум 2 раза за запуск


async function getAnimePoster(title){


try{


let clean =
title

.replace(/anime/gi,"")

.replace(/trailer/gi,"")

.replace(/reveals/gi,"")

.replace(/cast/gi,"")

.replace(/more/gi,"")

.trim();




const r =
await axios.get(

"https://api.jikan.moe/v4/anime",

{

params:{

q:clean,

limit:1

},

timeout:5000

}

);




if(
r.data.data &&
r.data.data.length
){


return r.data.data[0]
.images
.jpg
.large_image_url;


}


}catch(e){


console.log(

"Jikan ошибка:",
e.response?.status || e.message

);


}



return null;


}









async function sendDiscord(item,data){



const title =
await translate(
item.title
);



let description =
data.description;



if(!description){

description =
"Описание отсутствует";

}




description =
await translate(
description
);






await axios.post(

WEBHOOK,

{


username:

"Kibato News",



embeds:[{


title:

"🌸 "+title,



url:

item.link,



description:


description.substring(0,1800),



color:

16733695,



...(data.image ?

{

image:{

url:data.image

}

}

:{}

),




footer:{
text:
"Kibato News"
},


...(data.video ?

{

fields:[

{

name:"🎬 Трейлер",

value:
`[Смотреть видео](${data.video})`

}

]

}

:{}

),



timestamp:

new Date()


}]



});


}













async function main(){


let count=0;



for(const feed of feeds){


let rss;



try{


rss =
await parser.parseURL(feed);



}catch(e){


console.log(
"RSS ошибка:",
e.message
);


continue;

}







for(
const item of rss.items.slice(0,20)

){


try{



if(!item.link)
continue;



if(
sent.includes(item.link)
)
continue;




const checkText =

item.title +

" " +

(item.contentSnippet || "") +

" " +

(item.contentEncoded || "");






if(
badNews(checkText)
)
continue;





if(
!isAnimeNews(checkText)
)
continue;







let data =

await getData(item);







// максимум 2 обращения Jikan

if(
!data.image &&
posterRequests < 2
){



const poster =

await getAnimePoster(
item.title
);



if(poster){

data.image=poster;

}


posterRequests++;


}







await sendDiscord(

item,

data

);






sent.push(
item.link
);



count++;




console.log(

"Отправлено:",

item.title

);





await new Promise(

r=>setTimeout(r,3000)

);



}catch(e){



console.log(

"Ошибка новости:",

e.message

);



}



}



}







try{


fs.writeFileSync(

"sent.json",

JSON.stringify(

sent.slice(-1000),

null,

2

)

);



console.log(
"sent.json сохранён"
);



}catch(e){


console.log(
"Ошибка sent.json:",
e.message
);


}







console.log(

"Всего отправлено:",

count

);


}






main()
.catch(e=>{


console.log(

"Критическая ошибка:",

e.message

);


});
