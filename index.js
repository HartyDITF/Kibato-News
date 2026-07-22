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


const feeds=[
"https://animecorner.me/feed/"
];


let sent=[];


if(fs.existsSync("sent.json")){

try{

sent=JSON.parse(
fs.readFileSync("sent.json","utf8")
);

}catch{

sent=[];

}

}




// мусорные новости

function badNews(title){

const bad=[

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
"facebook",
"manga",
"novel",
"live action",
"episode",
"episodes"

];


return bad.some(x=>

title
.toLowerCase()
.includes(x)

);

}






async function translate(text){

if(!text)
return "";


try{


const r =
await axios.get(

"https://translate.googleapis.com/translate_a/single",

{

params:{

client:"gtx",
sl:"en",
tl:"ru",
dt:"t",
q:text.substring(0,3500)

}

});


return r.data[0]
.map(x=>x[0])
.join("");



}catch{

return text;

}


}





function clean(text){


return text

.replace(/<script[\s\S]*?<\/script>/gi,"")

.replace(/<style[\s\S]*?<\/style>/gi,"")

.replace(/<[^>]*>/g,"")

.replace(/facebooktwitterpinterestlinkedintumblrredditwhatsapp/gi,"")

.replace(/Источник:.*$/gi,"")

.replace(/Предыдущая запись.*$/gi,"")

.replace(/Следующая запись.*$/gi,"")

.replace(/\s+/g," ")

.trim();

}








async function getData(item){


let image=null;

let description="";



// картинка из RSS

if(item.media?.$?.url)
image=item.media.$.url;


if(item.thumbnail?.$?.url)
image=item.thumbnail.$.url;



// описание из RSS

if(item.contentEncoded)
description=item.contentEncoded;


if(!description)
description=item.contentSnippet;



try{


const page =
await axios.get(

item.link,

{

headers:{
"User-Agent":
"Mozilla/5.0"
},

timeout:8000

});


const $=
cheerio.load(page.data);



// запасные картинки

if(!image){

image=
$('meta[property="og:image"]')
.attr("content");

}



if(!image){

image=
$('meta[name="twitter:image"]')
.attr("content");

}



// нормальное описание

if(
!description ||
description.length<200
){

description=

$("article p")
.map((i,e)=>
$(e).text()
)
.get()
.slice(0,5)
.join(" ");

}



}catch(e){

console.log(
"Страница:",
e.message
);

}



return{

image,

description:clean(description)

};


}









async function send(item,data){


let title=
await translate(item.title);



let description=data.description;



if(
!description ||
description.length<100
){

description=
"Краткое описание отсутствует";

}


description=
await translate(
description.substring(0,1800)
);




await axios.post(

WEBHOOK,

{

username:
"Kibato News",


embeds:[{


title:
"🌸 "+title,


url:item.link,


description,


color:16733695,


image:data.image?
{
url:data.image
}
:
undefined,


footer:{
text:
"Kibato News"
},


timestamp:
new Date()


}]

}

);



}









async function main(){


let count=0;


const rss=
await parser.parseURL(
feeds[0]
);



for(
const item of rss.items.slice(0,15)
){



if(!item.link)
continue;



if(sent.includes(item.link))
continue;



if(badNews(item.title))
continue;



const data=
await getData(item);



await send(
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



}




fs.writeFileSync(

"sent.json",

JSON.stringify(
sent.slice(-300),
null,
2
)

);



console.log(
"Всего:",
count
);



}



main()
.catch(e=>

console.log(
"Ошибка:",
e.message
)

);
