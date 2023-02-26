import { Configuration, OpenAIApi } from 'openai';
import * as dotenv from 'dotenv';
import axios from 'axios';
import express from "express";
dotenv.config()

const configuration = new Configuration({
    apiKey: process.env.OpenAIKey,
});
const openai = new OpenAIApi(configuration);
const app = express();
const HATemplate = `
Acting as a personal assistant, summarize the following information in an concise and humourous manner. Try to make sure that the information fits in 8 sentences. Give the response using SSML as well, to make the update upbeat.
It's {{ as_timestamp(now()) | timestamp_custom('%H:%M') }}
Currently {{ states.weather.dark_sky.attributes.temperature }}°C outside, high of {{ states.sensor.weather_temp_high.state }}°C and a low of {{ states.sensor.weather_temp_low.state}}°C 

Latest Headlines:
{% set headlines = states.sensor.sky_news_headlines.attributes.entries[:5] | map(attribute='summary_detail') | map(attribute='value') | list | join('\n') %}
{{ headlines }}

Calendar for today:
{% for cal_events in expand(states.calendar.household) %}
{% if cal_events.attributes.all_day == False %}
{{ as_timestamp(cal_events.attributes.start_time) | timestamp_custom('%H:%M') }} @ {{ cal_events.attributes.message }}
{% endif %}
{%- endfor -%}
`;

async function createCompletition(prompt) {
    const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        temperature: 0.7,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });
    return response.data.choices[0].text;
}

async function sendToEcho(text) {
    try {
        let url = `${process.env.HomeAssistantUrl}/api/services/notify/${process.env.TargetDevice}`
        const response = await axios.post(url, { 'message': text }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.HomeAssistantApiKey}`
            },
        });
        return response.data;
    } catch (err) {
        console.log(err);
    }
}

async function renderTemplate() {
    let url = `${process.env.HomeAssistantUrl}/api/template`
    const response = await axios.post(url, { 'template': HATemplate }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.HomeAssistantApiKey}`
        },
    });
    return response.data;
}
app.get("/", async (req, res) => {
    let prompt = await renderTemplate();
    console.log(prompt);
    let completion = await createCompletition(prompt);
    console.log(completion);
    let announce = await sendToEcho(completion);
    console.log(announce);
    return res.status(200).send();
});

app.listen(process.env.PORT || 4000, function () {
    console.log(`Listening on port ${process.env.PORT || 4000}!`);
});