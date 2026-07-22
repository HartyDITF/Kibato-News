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

sent =
JSON.parse(
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
"event",
"marine day",
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
q:text.substring(0,2000)

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

.replace(/Источник:.*/gi,"")

.replace(/Source:.*/gi,"")

.replace(/Автор:.*/gi,"")

.replace(/Written by.*/gi,"")

.replace(/Also Read.*/gi,"")

.replace(/Также прочитайте.*/gi,"")

.replace(/Предыдущая запись.*/gi,"")

.replace(/Следующая запись.*/gi,"")

.replace(/Комментарии.*/gi,"")

.replace(/Загрузка.*/gi,"")

.replace(/&nbsp;/g," ")

.replace(/&amp;/g,"&")

.replace(/\s+/g," ")

.trim();

}









function makeDescription(text){


let result =
cleanText(text);



if(!result)
return "";



// берём только первые предложения

let parts =
result
.split(". ")
.filter(x=>x.length>30);



result =
parts
.slice(0,5)
.join(". ");



if(result.length>900){

result =
result.substring(0,900)
+"...";

}



return result;

}









async function getData(item){


let image=null;

let description="";




// картинка RSS


if(item.media?.$.url){

image=item.media.$.url;

}



if(item.thumbnail?.$.url){

image=item.thumbnail.$.url;

}




// сначала берём короткое RSS описание


description =
item.contentSnippet ||
"";





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

}

);



const $ =
cheerio.load(page.data);





if(!image){


image =
$('meta[property="og:image"]')
.attr("content");

}



if(!image){


image =
$('meta[name="twitter:image"]')
.attr("content");

}




if(!image){


image =
$("article img")
.first()
.attr("src");

}





// если RSS плохой

if(description.length<150){


description =

$("article p")
.slice(0,5)
.map((i,e)=>
$(e).text()
)
.get()
.join(" ");

}



}catch(e){


console.log(
"Страница ошибка:",
e.message
);


}




return{

image,

description:
makeDescription(description)

};


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
"Краткое описание отсутствует";

}



description =
await translate(
description.substring(0,900)
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



...(data.image?

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



if(sent.includes(item.link))
continue;



if(badNews(item.title))
continue;




const data =
await getData(item);



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





main()
.catch(e=>

console.log(
"Критическая ошибка:",
e.message
)

);
