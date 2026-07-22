import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK =
process.env.DISCORD_WEBHOOK;


const parser = new Parser();


const feeds = [

"https://www.animenewsnetwork.com/all/rss.xml",

"https://www.crunchyroll.com/newsrss",

"https://animecorner.me/feed/"

];


let sent=[];


if(fs.existsSync("sent.json")){

sent =
JSON.parse(
fs.readFileSync("sent.json")
);

}



async function getImage(url){

try{

const html =
await axios.get(url,{
headers:{
"User-Agent":"Mozilla/5.0"
}
});


const $ =
cheerio.load(html.data);


return (
$('meta[property="og:image"]')
.attr("content")
||
null
);


}catch{

return null;

}

}




function translate(text){

return text

.replace(/trailer/gi,"трейлер")

.replace(/new season/gi,"новый сезон")

.replace(/anime film/gi,"аниме-фильм")

.replace(/announced/gi,"анонсирован")

.replace(/release date/gi,"дата выхода")

.replace(/reveals/gi,"представляет")

.replace(/cast/gi,"актерский состав")

.replace(/staff/gi,"создатели");

}



async function sendNews(item,image){


await axios.post(
WEBHOOK,
{


username:
"Kibato News",


embeds:[{

title:
"🌸 "+translate(item.title),


url:
item.link,


description:
translate(
item.contentSnippet ||
"Новая аниме-новость"
)
.substring(0,900),


color:
16733695,


image:
image
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


for(
const feed of feeds
){


try{


const rss =
await parser.parseURL(feed);



for(
const item of rss.items.slice(0,5)
){



if(
sent.includes(item.link)
)
continue;



const image =
await getImage(item.link);



await sendNews(
item,
image
);



sent.push(item.link);



console.log(
"Отправлено:",
item.title
);



}



}catch(e){

console.log(
"Ошибка RSS",
feed,
e.message
);

}


}



fs.writeFileSync(
"sent.json",
JSON.stringify(
sent.slice(-200),
null,
2
)
);


}


main();
