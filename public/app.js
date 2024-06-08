let caughtUpList = []; // Array para almacenar los manga-items que están "caught up"
let completedItList = []; // Array para almacenar los manga-items que están "completed it"
let mangaImages = {}; // Objeto para almacenar las URLs de las imágenes actualizadas
let mangaRatings = {}; // Objeto para almacenar las calificaciones de los mangas

async function loadManga(decade) {
    document.getElementById('title').style.display = 'none';
    document.getElementById('buttons').style.display = 'none';
    document.getElementById('extra-buttons').style.display = 'none';
    document.getElementById('back-button').style.display = 'block'; // Mostrar el botón de regreso

    console.log(`Loading manga for decade: ${decade}`); // Registro de depuración

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

    const mangaListContainer = document.getElementById('manga-list');
    mangaListContainer.innerHTML = ''; // Limpiar contenido previo
    mangaListContainer.style.display = 'flex'; // Mostrar contenedor de manga-list

    let allMangas = [];

    for (let year = startYear; year <= endYear; year++) {
        let page = 1;
        let mangasForYear = [];
        while (mangasForYear.length < 5) {
            try {
                const mangaList = await fetchPopularManga(year, year + 1, page);
                console.log(`Fetched manga data for ${year}, page ${page}:`, mangaList); // Registro de depuración

                let newMangas = mangaList.flatMap(yearData => yearData.mangas).filter(manga => {
                    return !caughtUpList.some(item => item.querySelector('img').alt === manga.title.romaji) &&
                           !completedItList.some(item => item.querySelector('img').alt === manga.title.romaji);
                });

                mangasForYear = mangasForYear.concat(newMangas);
                page++;

                if (newMangas.length === 0) break; // No more new mangas to fetch
            } catch (error) {
                console.error('Error fetching manga data:', error);
                break;
            }
        }

        allMangas = allMangas.concat(mangasForYear.slice(0, 5)); // Agregar solo los primeros 5
    }

    allMangas.forEach(manga => {
        const mangaDiv = document.createElement('div');
        mangaDiv.className = 'manga-item';

        const mangaImg = document.createElement('img');
        mangaImg.src = mangaImages[manga.title.romaji] || manga.coverImage.large; // Usar la imagen guardada si existe, si no la original
        mangaImg.alt = manga.title.romaji;

        const mangaTitle = document.createElement('p');
        if (manga.title.english) {
            mangaTitle.innerText = manga.title.english;
        } else {
            mangaTitle.innerText = manga.title.romaji;
        }

        mangaDiv.appendChild(mangaImg);
        mangaDiv.appendChild(mangaTitle);
        mangaListContainer.appendChild(mangaDiv);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options';
        optionsDiv.innerHTML = `
            <a class="read-next-volume">Read Next Volume</a>
            <a class="caught-up">I'm Up to Date</a>
            <a class="completed-it">Finished It</a>
        `;
        mangaDiv.appendChild(optionsDiv);

        mangaImg.addEventListener('click', () => {
            const isVisible = optionsDiv.style.display === 'flex';
            document.querySelectorAll('.options').forEach(opt => opt.style.display = 'none');
            optionsDiv.style.display = isVisible ? 'none' : 'flex';
        });

        const readNextVolumeLink = optionsDiv.querySelector('.read-next-volume');
        const caughtUpLink = optionsDiv.querySelector('.caught-up');
        const completedItLink = optionsDiv.querySelector('.completed-it');

        if (readNextVolumeLink && caughtUpLink && completedItLink) {
            readNextVolumeLink.addEventListener('click', readNextVolume);
            caughtUpLink.addEventListener('click', caughtUp);
            completedItLink.addEventListener('click', completedIt);
        } else {
            console.error('Error: Missing one or more option links', {
                readNextVolumeLink,
                caughtUpLink,
                completedItLink
            });
        }
    });
}

async function fetchPopularManga(startYear, endYear, page = 1) {
    const url = '/graphql';
    const queries = [];

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
    const variables = { startYear: startYear * 10000, endYear: endYear * 10000, page };
    queries.push({ query, variables });
    console.log('Generated query:', { query, variables }); // Registro de depuración

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

function readNextVolume(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    const newImageUrl = prompt('Please enter the URL for the next volume image:');
    if (newImageUrl) {
        const mangaImg = mangaItem.querySelector('img');
        mangaImg.src = newImageUrl;
        mangaImages[mangaImg.alt] = newImageUrl; // Guardar la nueva URL de la imagen
        saveData(); // Guardar los datos actualizados
    }
}

function caughtUp(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    if (!caughtUpList.some(item => item.querySelector('img').alt === mangaItem.querySelector('img').alt)) {
        caughtUpList.push(mangaItem.cloneNode(true));
        saveData(); // Guardar los datos actualizados
    }
    console.log('Caught Up List:', caughtUpList); // Registro de depuración
}

function completedIt(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    if (!completedItList.some(item => item.querySelector('img').alt === mangaItem.querySelector('img').alt)) {
        completedItList.push(mangaItem.cloneNode(true));
        saveData(); // Guardar los datos actualizados
    }
    console.log('Completed It List:', completedItList); // Registro de depuración
}

function justReadNewChapters(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    const index = caughtUpList.findIndex(item => item.querySelector('img').alt === mangaItem.querySelector('img').alt);
    if (index > -1) {
        const [item] = caughtUpList.splice(index, 1);
        caughtUpList.unshift(item); // Mover el item al principio de la lista
        saveData(); // Guardar los datos actualizados
    }
    console.log('Updated Caught Up List:', caughtUpList); // Registro de depuración
}

function updateLatestVolume(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    const newImageUrl = prompt('Please enter the URL for the latest volume image:');
    if (newImageUrl) {
        const mangaImg = mangaItem.querySelector('img');
        mangaImg.src = newImageUrl;
        mangaImages[mangaImg.alt] = newImageUrl; // Guardar la nueva URL de la imagen
        saveData(); // Guardar los datos actualizados
    }
}

function notUpToDateAnymore(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    const altText = mangaItem.querySelector('img').alt;
    caughtUpList = caughtUpList.filter(item => item.querySelector('img').alt !== altText);
    completedItList = completedItList.filter(item => item.querySelector('img').alt !== altText);
    saveData(); // Guardar los datos actualizados
    console.log('Caught Up List:', caughtUpList); // Registro de depuración
    console.log('Completed It List:', completedItList); // Registro de depuración
}

function rateManga(event) {
    event.preventDefault();
    const mangaItem = event.target.closest('.manga-item');
    const altText = mangaItem.querySelector('img').alt;
    const rating = parseInt(prompt('Rate this manga (1-10):'), 10);

    if (rating >= 1 && rating <= 10) {
        mangaRatings[altText] = rating;
        completedItList.sort((a, b) => {
            const ratingA = mangaRatings[a.querySelector('img').alt] || 0;
            const ratingB = mangaRatings[b.querySelector('img').alt] || 0;
            return ratingB - ratingA; // Ordenar de mayor a menor
        });
        saveData(); // Guardar los datos actualizados
        console.log('Updated Completed It List:', completedItList); // Registro de depuración
    } else {
        alert('Please enter a valid rating between 1 and 10.');
    }
}

function goBackToHome() {
    document.getElementById('title').style.display = 'block';
    document.getElementById('buttons').style.display = 'flex';
    document.getElementById('extra-buttons').style.display = 'flex';
    document.getElementById('manga-list').style.display = 'none';
    document.getElementById('back-button').style.display = 'none'; // Ocultar el botón de regreso
    document.getElementById('manga-list').innerHTML = ''; // Limpiar contenido previo
}

function loadCaughtUpManga() {
    document.getElementById('title').style.display = 'none';
    document.getElementById('buttons').style.display = 'none';
    document.getElementById('extra-buttons').style.display = 'none';
    document.getElementById('back-button').style.display = 'block'; // Mostrar el botón de regreso

    const mangaListContainer = document.getElementById('manga-list');
    mangaListContainer.innerHTML = ''; // Limpiar contenido previo
    mangaListContainer.style.display = 'flex'; // Mostrar contenedor de manga-list

    caughtUpList.forEach(mangaItem => {
        const clone = mangaItem.cloneNode(true);
        updateOptionsForCaughtUpItem(clone); // Actualizar opciones si no son correctas
        mangaListContainer.appendChild(clone);
    });
}

function loadCompletedManga() {
    document.getElementById('title').style.display = 'none';
    document.getElementById('buttons').style.display = 'none';
    document.getElementById('extra-buttons').style.display = 'none';
    document.getElementById('back-button').style.display = 'block'; // Mostrar el botón de regreso

    const mangaListContainer = document.getElementById('manga-list');
    mangaListContainer.innerHTML = ''; // Limpiar contenido previo
    mangaListContainer.style.display = 'flex'; // Mostrar contenedor de manga-list

    completedItList.forEach(mangaItem => {
        const clone = mangaItem.cloneNode(true);
        updateOptionsForCompletedItem(clone); // Actualizar opciones si no son correctas
        mangaListContainer.appendChild(clone);
    });
}

function updateOptionsForCaughtUpItem(mangaItem) {
    let optionsDiv = mangaItem.querySelector('.options');
    if (optionsDiv) {
        optionsDiv.remove(); // Eliminar opciones existentes
    }
    optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';
    optionsDiv.innerHTML = `
        <a class="just-read-new-chapters">Just Read Latest Chapter/s</a>
        <a class="not-up-to-date-anymore">No Longer Up to Date</a>
        <a class="update-latest-volume">Update Volume Cover</a>
    `;
    mangaItem.appendChild(optionsDiv);

    const justReadNewChaptersLink = optionsDiv.querySelector('.just-read-new-chapters');
    const notUpToDateAnymoreLink = optionsDiv.querySelector('.not-up-to-date-anymore');
    const updateLatestVolumeLink = optionsDiv.querySelector('.update-latest-volume');

    justReadNewChaptersLink.addEventListener('click', justReadNewChapters);
    notUpToDateAnymoreLink.addEventListener('click', notUpToDateAnymore);
    updateLatestVolumeLink.addEventListener('click', updateLatestVolume);

    mangaItem.querySelector('img').addEventListener('click', () => {
        const isVisible = optionsDiv.style.display === 'flex';
        document.querySelectorAll('.options').forEach(opt => opt.style.display = 'none');
        optionsDiv.style.display = isVisible ? 'none' : 'flex';
    });
}

function updateOptionsForCompletedItem(mangaItem) {
    let optionsDiv = mangaItem.querySelector('.options');
    if (optionsDiv) {
        optionsDiv.remove(); // Eliminar opciones existentes
    }
    optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';
    optionsDiv.innerHTML = `
        <a class="rate-manga">Rate Manga</a>
        <a class="update-latest-volume">Update Volume Cover</a>
    `;
    mangaItem.appendChild(optionsDiv);

    const rateMangaLink = optionsDiv.querySelector('.rate-manga');
    const updateLatestVolumeLink = optionsDiv.querySelector('.update-latest-volume');

    rateMangaLink.addEventListener('click', rateManga);
    updateLatestVolumeLink.addEventListener('click', updateLatestVolume);

    mangaItem.querySelector('img').addEventListener('click', () => {
        const isVisible = optionsDiv.style.display === 'flex';
        document.querySelectorAll('.options').forEach(opt => opt.style.display = 'none');
        optionsDiv.style.display = isVisible ? 'none' : 'flex';
    });
}

function saveData() {
    localStorage.setItem('caughtUpList', JSON.stringify(caughtUpList.map(item => item.outerHTML)));
    localStorage.setItem('completedItList', JSON.stringify(completedItList.map(item => item.outerHTML)));
    localStorage.setItem('mangaImages', JSON.stringify(mangaImages));
    localStorage.setItem('mangaRatings', JSON.stringify(mangaRatings));
}

function loadData() {
    const caughtUpData = localStorage.getItem('caughtUpList');
    const completedItData = localStorage.getItem('completedItList');
    const mangaImagesData = localStorage.getItem('mangaImages');
    const mangaRatingsData = localStorage.getItem('mangaRatings');

    if (caughtUpData) {
        caughtUpList = JSON.parse(caughtUpData).map(html => {
            const div = document.createElement('div');
            div.innerHTML = html;
            const mangaItem = div.firstChild;
            updateOptionsForCaughtUpItem(mangaItem); // Asegurar que tenga las opciones correctas
            return mangaItem;
        });
    }

    if (completedItData) {
        completedItList = JSON.parse(completedItData).map(html => {
            const div = document.createElement('div');
            div.innerHTML = html;
            const mangaItem = div.firstChild;
            updateOptionsForCompletedItem(mangaItem); // Asegurar que tenga las opciones correctas
            return mangaItem;
        });
    }

    if (mangaImagesData) {
        mangaImages = JSON.parse(mangaImagesData);
    }

    if (mangaRatingsData) {
        mangaRatings = JSON.parse(mangaRatingsData);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed'); // Registro de depuración
    loadData(); // Cargar datos almacenados al cargar la página
});
