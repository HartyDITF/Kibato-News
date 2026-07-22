import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK = process.env.DISCORD_WEBHOOK;


const parser = new Parser();


const feeds = [

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



function isBad(title){

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
"live action",
"event",
"concert"

];


return bad.some(
x =>
title
.toLowerCase()
.includes(x)
);

}




async function translate(text){

try{

const clean =
text
.replace(/<[^>]*>/g,"")
.substring(0,2000);



const r =
await axios.get(
"https://translate.googleapis.com/translate_a/single",
{

params:{

client:"gtx",
sl:"en",
tl:"ru",
dt:"t",
q:clean

}

});



return r.data[0]
.map(
x=>x[0]
)
.join("");



}catch{

return text;

}

}





async function getImage(url){


try{


const page =
await axios.get(
url,
{

headers:{
"User-Agent":
"Mozilla/5.0"
},

timeout:10000

});


const $ =
cheerio.load(
page.data
);



return (

$('meta[property="og:image"]')
.attr("content")

||

$('meta[name="twitter:image"]')
.attr("content")

||

null

);



}catch{

return null;

}

}




async function sendDiscord(
item,
image
){


const title =
await translate(
item.title
);



const description =
await translate(
item.contentSnippet ||
item.content ||
"Новая аниме-новость"
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


description:
description.substring(0,3500),


color:16733695,


image:image
?
{
url:image
}
:
undefined,


footer:{
text:
"Kibato News"
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



let count=0;



for(
const feed of feeds
){


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
isBad(item.title)
)
continue;



const image =
await getImage(
item.link
);



await sendDiscord(
item,
image
);



sent.push(
item.link
);



count++;



await new Promise(
r=>setTimeout(r,2000)
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
"Отправлено:",
count
);


}



main();
