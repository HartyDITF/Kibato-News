import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK = process.env.DISCORD_WEBHOOK;


const parser = new Parser({

customFields:{

item:[

"content:encoded",

"media:content",

"media:thumbnail"

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




function isBad(title){


const bad=[

"game",
"controller",
"figure",
"merchandise",
"merch",
"podcast",
"opinion",
"column",
"live action",
"concert"

];


return bad.some(

x=>

title
.toLowerCase()
.includes(x)

);

}





async function translate(text){


if(!text)
return "Новая аниме-новость";



try{


const clean =

text

.replace(/<script[\s\S]*?<\/script>/gi,"")

.replace(/<style[\s\S]*?<\/style>/gi,"")

.replace(/<[^>]*>/g,"")

.replace(/&nbsp;/g," ")

.replace(/&amp;/g,"&")

.trim();



const result =

await axios.get(

"https://translate.googleapis.com/translate_a/single",

{

params:{

client:"gtx",

sl:"en",

tl:"ru",

dt:"t",

q:
clean.substring(0,4500)

}

}

);



return result.data[0]

.map(

x=>x[0]

)

.join("")

.trim();



}catch(e){


console.log(
"Перевод ошибка"
);


return text;


}


}





async function getImage(item){


try{


// RSS картинка

if(
item["media:content"]?.url
){

return item["media:content"].url;

}



if(
item["media:thumbnail"]?.url
){

return item["media:thumbnail"].url;

}




if(
item.enclosure?.url
){

return item.enclosure.url;

}




// запасной вариант через страницу


const page =

await axios.get(

item.link,

{

headers:{

"User-Agent":

"Mozilla/5.0"

},

timeout:10000

}

);



const $

=
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
"Нет картинки"
);


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





const rawDescription =


item["content:encoded"]

||

item.content

||

item.contentSnippet

||

item.summary

||

"Новая аниме-новость";




const description =

await translate(
rawDescription
);




let embed={


title:

"🌸 "+title.substring(0,256),


url:item.link,


description:

description.substring(0,4096),


color:16733695,



footer:{

text:

"Kibato News"

},


timestamp:

new Date()


};





if(image){

embed.image={

url:image

};

}





await axios.post(

WEBHOOK,

{


username:

"Kibato News",



embeds:[embed],



components:[{


type:1,


components:[{

type:2,

style:5,

label:"📖 Читать",

url:item.link

}]


}]


}

);


}







async function main(){



let count=0;



for(
const feed of feeds
){


try{


const rss =

await parser.parseURL(feed);




for(

const item of rss.items.slice(0,15)

){



if(!item.link)

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

await getImage(item);





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



}catch(e){


console.log(

"RSS ошибка:",

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

"Отправлено:",

count

);


}




main();
