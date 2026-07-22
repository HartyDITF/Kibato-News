import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK = process.env.DISCORD_WEBHOOK;


const parser = new Parser({

customFields:{
item:[
["media:content","media"],
["content:encoded","content"]
]
}

});



const feeds = [

"https://www.animenewsnetwork.com/all/rss.xml",
"https://animecorner.me/feed/"

];



let sent=[];


if(fs.existsSync("sent.json")){

try{

sent =
JSON.parse(
fs.readFileSync("sent.json","utf8")
);

}catch{

sent=[];

}

}




function blocked(title){


const bad=[

"game",
"controller",
"figure",
"merch",
"interview",
"review",
"column",
"opinion",
"podcast",
"manga",
"novel",
"live-action",
"movie review",
"marine day",
"event"

];


return bad.some(x=>
title.toLowerCase().includes(x)
);


}




function translate(text){

if(!text)
return "";


return text

.replace(/trailer/gi,"трейлер")

.replace(/anime film/gi,"аниме-фильм")

.replace(/anime/gi,"аниме")

.replace(/season/gi,"сезон")

.replace(/new/gi,"новый")

.replace(/announced/gi,"анонсирован")

.replace(/reveals/gi,"представляет")

.replace(/cast/gi,"актёрский состав")

.replace(/staff/gi,"создатели")

.replace(/theme song/gi,"тематическая песня")

.replace(/release/gi,"выход")

.replace(/October/gi,"октября")

.replace(/November/gi,"ноября");

}





async function translateFull(text){


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

q:text.substring(0,900)

}

});


return r.data[0]
.map(x=>x[0])
.join("");


}catch{

return translate(text);

}


}




async function getImage(url,item){

try{


if(item.media?.$.url)
return item.media.$.url;



if(item.enclosure?.url)
return item.enclosure.url;



const page =
await axios.get(
url,
{
headers:{
"User-Agent":"Mozilla/5.0"
},
timeout:10000
}
);



const $ =
cheerio.load(page.data);



return (

$('meta[property="og:image"]')
.attr("content")

||

$('meta[name="twitter:image"]')
.attr("content")

||

null

);



}catch(e){

console.log(
"Картинка не найдена:",
url
);

return null;

}


}



async function send(item,image){


const title =
await translateFull(item.title);


const description =
await translateFull(
item.contentSnippet ||
item.content ||
"Новая аниме-новость"
);


const cleanDescription =
description
.replace(/<[^>]*>/g,"")
.replace(/&nbsp;/g," ")
.replace(/&amp;/g,"&")
.trim();
await axios.post(
WEBHOOK,
{


username:
"Kibato News",


embeds:[{


title:
"🌸 "+title,


url:item.link,


description:
cleanDescription.substring(0,3500),


color:16733695,


image:image?
{
url:image
}
:
undefined,


footer:{
text:"Kibato News"
},


timestamp:
new Date()


}],


components:[{

type:1,

components:[{

type:2,

style:5,

label:"📖 Читать",

url:item.link

}]

}]


});


}




async function main(){



let added=0;



for(
const feed of feeds
){



try{


const rss =
await parser.parseURL(feed);



for(
const item of rss.items.slice(0,10)
){



if(
!item.link
)
continue;



if(
sent.includes(item.link)
)
continue;



if(
blocked(item.title)
)
continue;



const image =
await getImage(
item.link,
item
);



await send(
item,
image
);



sent.push(
item.link
);


added++;


await new Promise(
r=>setTimeout(r,1500)
);


}



}catch(e){

console.log(
"RSS ошибка",
e.message
);

}


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
"Новых новостей:",
added
);


}



main();
