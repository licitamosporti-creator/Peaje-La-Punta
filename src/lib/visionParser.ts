import { Knex } from 'knex';
import crypto from 'crypto';

export async function parseHourlyWithAI(
  fileBuffer: Buffer,
  mimeType: string,
  stationId: string,
  userId: string,
  filename: string,
  tx: Knex
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en el servidor. Agrega tu clave en el archivo .env para habilitar la Inteligencia Artificial.');
  }

  if (mimeType === 'application/pdf') {
    throw new Error('Por favor, toma una captura de pantalla (PNG o JPG) de la tabla del PDF y súbela como imagen para asegurar la correcta lectura visual de las columnas.');
  }

  const base64Image = fileBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const promptText = `
Eres un analista de datos avanzado. Te proporcionaré una imagen de una tabla de recaudo y tráfico horario de un peaje.
Extrae la sección "TOTAL ESTACIÓN" o los datos totales consolidados de la estación. 
Para cada hora reportada (desde "00 A 01" hasta "23 A 24"), necesito la cantidad de vehículos de Categoría I, II, III, y IV.

Formato de respuesta OBLIGATORIO en JSON válido:
{
  "date": "YYYY-MM-DD", (infiere la fecha desde la columna FECHA o el año actual si no está, asume el año en curso)
  "hourlyData": [
    { "hour": 0, "cat_I": 0, "cat_II": 0, "cat_III": 0, "cat_IV": 0 },
    ...
    { "hour": 23, "cat_I": 0, "cat_II": 0, "cat_III": 0, "cat_IV": 0 }
  ]
}

Responde ÚNICAMENTE con el bloque JSON, sin ningún texto adicional, sin código de formato markdown (\`\`\`json).
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenAI Error:', errBody);
      throw new Error(`Error en la API de IA: ${response.status} ${response.statusText}`);
    }

    const aiResult = await response.json();
    let jsonString = aiResult.choices[0].message.content.trim();
    
    // Clean potential markdown wrap
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.substring(7);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.substring(0, jsonString.length - 3);
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString.trim());
    } catch (parseErr) {
      console.error('Failed to parse AI JSON:', jsonString);
      throw new Error('La Inteligencia Artificial no pudo estructurar correctamente la tabla. Por favor, intenta subir una imagen más nítida.');
    }

    const { date, hourlyData } = parsedData;
    if (!date || !hourlyData || !Array.isArray(hourlyData)) {
      throw new Error('Formato de datos devuelto por la IA es inválido.');
    }

    let importedRows = 0;
    const hourlyInserts = [];

    // Delete existing hourly records for this date to ensure idempotency
    await tx('hourly_traffic').where('station_id', stationId).where('date', date).delete();

    for (const hData of hourlyData) {
      const { hour, cat_I, cat_II, cat_III, cat_IV } = hData;
      
      if (cat_I > 0) hourlyInserts.push({ id: crypto.randomUUID(), station_id: stationId, date, category: 'Cat I', hour, quantity: cat_I });
      if (cat_II > 0) hourlyInserts.push({ id: crypto.randomUUID(), station_id: stationId, date, category: 'Cat II', hour, quantity: cat_II });
      if (cat_III > 0) hourlyInserts.push({ id: crypto.randomUUID(), station_id: stationId, date, category: 'Cat III', hour, quantity: cat_III });
      if (cat_IV > 0) hourlyInserts.push({ id: crypto.randomUUID(), station_id: stationId, date, category: 'Cat IV', hour, quantity: cat_IV });
    }

    if (hourlyInserts.length > 0) {
      await tx('hourly_traffic').insert(hourlyInserts);
      importedRows += hourlyInserts.length;
    }

    return { importedRows, date };

  } catch (err: any) {
    throw new Error(err.message || 'Error desconocido al analizar la imagen.');
  }
}
