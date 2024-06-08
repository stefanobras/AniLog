const express = require('express');
const fetch = require('node-fetch');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;
const DATA_FILE_PATH = path.join(__dirname, 'data.json');

// Configuración del proxy
app.use('/graphql', createProxyMiddleware({
  target: 'https://graphql.anilist.co',
  changeOrigin: true,
  pathRewrite: {
    '^/graphql': '/', // Reescribe la ruta
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Origin', 'https://graphql.anilist.co');
  }
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Route handler
app.get('/', (req, res) => {
  res.render('index', { title: 'AniLog' });
});

// API endpoint to get popular manga for a decade
app.get('/api/manga/:decade', async (req, res) => {
  try {
    const decade = req.params.decade;
    let startYear, endYear;

    switch (decade) {
      case '2020s':
        startYear = 2020;
        endYear = 2024;
        break;
      case '2010s':
        startYear = 2010;
        endYear = 2019;
        break;
      case '2000s':
        startYear = 2000;
        endYear = 2009;
        break;
      case '1990s':
        startYear = 1990;
        endYear = 1999;
        break;
      case '1980s':
        startYear = 1980;
        endYear = 1989;
        break;
      case '1970s':
        startYear = 1970;
        endYear = 1979;
        break;
      case '1960s':
        startYear = 1960;
        endYear = 1969;
        break;
      default:
        console.error('Invalid decade');
        return;
    }

    console.log(`Fetching manga for decade: ${decade}`); // Registro de depuración
    const mangaList = await fetchPopularManga(startYear, endYear);
    console.log('Fetched manga list:', mangaList); // Registro de depuración
    res.json(mangaList);
  } catch (err) {
    console.error('Error in API handler:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Function to fetch popular manga data for a decade
async function fetchPopularManga(startYear, endYear, page = 1) {
  const url = 'http://localhost:3000/graphql';
  const queries = [];

  for (let year = startYear; year <= endYear; year++) {
    const query = `
      query ($startYear: FuzzyDateInt, $endYear: FuzzyDateInt, $page: Int) {
        Page(page: $page, perPage: 5) {
          media(format: MANGA, countryOfOrigin: JP, sort: POPULARITY_DESC, startDate_greater: $startYear, startDate_lesser: $endYear) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
          }
        }
      }
    `;
    const variables = { startYear: year * 10000, endYear: (year + 1) * 10000, page };
    queries.push({ query, variables });
    console.log('Generated query:', { query, variables }); // Registro de depuración
  }

  const fetchPromises = queries.map(q =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(q)
    })
    .then(response => response.json())
    .then(data => {
      if (data.errors) {
        throw new Error(data.errors.map(error => error.message).join(', '));
      }
      return data;
    })
  );

  return Promise.all(fetchPromises).then(results =>
    results.map((result, index) => {
      if (!result.data || !result.data.Page || !result.data.Page.media) {
        throw new Error('Invalid data structure');
      }
      return {
        year: startYear + index,
        mangas: result.data.Page.media
      };
    })
  );
}

// Endpoint to save data
app.post('/api/saveData', (req, res) => {
  const data = req.body;
  fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error saving data:', err);
      return res.status(500).send('Internal Server Error');
    }
    console.log('Data saved successfully');
    res.sendStatus(200);
  });
});

// Endpoint to load data
app.get('/api/loadData', (req, res) => {
  fs.readFile(DATA_FILE_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error('Error loading data:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.json(JSON.parse(data));
  });
});

// Middleware function to handle errors
app.use((err, req, res, next) => {
  console.error('Middleware error:', err.stack);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
