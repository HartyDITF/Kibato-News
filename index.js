import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK = process.env.DISCORD_WEBHOOK;



const parser = new Parser({
customFields:{
item:[
["content:encoded","contentEncoded"],
["media:content","media"]
]
}
});



const feeds=[

"https://www.animenewsnetwork.com/all/rss.xml",
"https://animecorner.me/feed/"

];



let sent=[];

let posterRequests=0;



if(fs.existsSync("sent.json")){

try{

sent=JSON.parse(
fs.readFileSync("sent.json","utf8")
);

}catch{

sent=[];

}

}





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
"live action",
"movie review"

];


return bad.some(x=>
title.toLowerCase().includes(x)
);

}







async function translate(text){

if(!text)
return "";


try{


const r=await axios.get(

"https://translate.googleapis.com/translate_a/single",

{

params:{

client:"gtx",
sl:"en",
tl:"ru",
dt:"t",
q:text.substring(0,2500)

}

});


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

.replace(/Источник:.*$/gi,"")

.replace(/Source:.*$/gi,"")

.replace(/Автор:.*$/gi,"")

.replace(/Also Read[\s\S]*$/gi,"")

.replace(/Также прочитайте[\s\S]*$/gi,"")

.replace(/Предыдущая запись[\s\S]*$/gi,"")

.replace(/Следующая запись[\s\S]*$/gi,"")

.replace(/Загрузка.*$/gi,"")

.replace(/&nbsp;/g," ")

.replace(/&amp;/g,"&")

.replace(/\s+/g," ")

.trim();

}








async function getArticleData(url,item){


let image=null;

let description="";



try{



if(item.media?.$.url){

image=item.media.$.url;

}



if(item.contentEncoded){

description=item.contentEncoded;

}



const page=await axios.get(

url,

{

headers:{
"User-Agent":"Mozilla/5.0"
},

timeout:8000

});


const $=cheerio.load(page.data);




if(!image){

image=$('meta[property="og:image"]')
.attr("content");

}



if(!image){

image=$('meta[name="twitter:image"]')
.attr("content");

}




if(!image){

image=$("article img")
.first()
.attr("src");

}




// Берём только первые абзацы

if(description){

description=
$("p")
.slice(0,4)
.map((i,e)=>$(e).text())
.get()
.join(" ");

}



if(!description){

description=
$("article p")
.slice(0,4)
.map((i,e)=>$(e).text())
.get()
.join(" ");

}



}catch(e){

console.log(
"Ошибка страницы:",
e.message
);

}



return{

image,
description

};


}









async function getAnimePoster(title){


try{


const clean=title

.replace(/anime/gi,"")

.replace(/trailer/gi,"")

.replace(/reveals/gi,"")

.replace(/more cast/gi,"")

.trim();



const r=await axios.get(

"https://api.jikan.moe/v4/anime",

{

params:{
q:clean,
limit:1
},

timeout:5000

}

);



if(r.data.data?.length){

return r.data.data[0]
.images
.jpg
.large_image_url;

}



}catch(e){

console.log(
"Jikan:",
e.response?.status || e.message
);

}



return null;

}









async function sendDiscord(item,data){


const title=
await translate(
item.title
);



let description=
cleanText(
data.description
);



if(!description){

description=
"Новое событие из мира аниме";

}



description=
await translate(
description.substring(0,2000)
);





if(!data.image && posterRequests < 2){


const poster=
await getAnimePoster(
item.title
);


if(poster){

data.image=poster;

}


posterRequests++;

}







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


...(data.image?

{

image:{
url:data.image
}

}

:{}



),


footer:{
text:"Kibato News"
},


timestamp:new Date()


}]


});


}









async function main(){


let count=0;



for(const feed of feeds){



let rss;


try{


rss=
await parser.parseURL(feed);



console.log(
"RSS:",
feed,
rss.items.length
);



}catch(e){

console.log(
"RSS ошибка:",
e.message
);

continue;

}







for(const item of rss.items.slice(0,30)){


try{



if(!item.link)
continue;



if(sent.includes(item.link)){

console.log(
"Уже было:",
item.title
);

continue;

}



if(badNews(item.title)){

console.log(
"Фильтр:",
item.title
);

continue;

}




const data=
await getArticleData(
item.link,
item
);




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



fs.writeFileSync(

"sent.json",

JSON.stringify(
sent.slice(-500),
null,
2
)

);



console.log(
"Всего отправлено:",
count
);


}





main();
