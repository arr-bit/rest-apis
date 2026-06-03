/**
 * @author      ARR Official
 * @title       Spotify Play API
 * @description API untuk auto search dan download lagu Spotify paling atas (hasil teratas)
 * @baseurl     https://spotmate.online
 * @tags        downloader, music, spotify, audio
 * @language    javascript
 */

const axios = require('axios');
const qs = require('qs');

// Fungsi konversi milliseconds ke format menit:detik
function ms(milliseconds) {
    if (!milliseconds) return "0:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Fungsi untuk search Spotify (menggunakan API publik tanpa auth)
async function searchSpotify(query) {
    try {
        // Menggunakan API Spotify Search alternatif
        const response = await axios.get('https://spotifysearch.simonbogarde.repl.co/search', {
            params: {
                q: query,
                limit: 5
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.tracks && response.data.tracks.length > 0) {
            return {
                tracks: response.data.tracks.map(track => ({
                    name: track.name,
                    artists: track.artists.map(artist => ({ name: artist.name })),
                    duration_ms: track.duration_ms,
                    url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
                    album: {
                        name: track.album?.name || "Unknown Album",
                        images: track.album?.images || []
                    }
                }))
            };
        }
        
        // Fallback ke API lain
        const response2 = await axios.get('https://saavn.me/search/songs', {
            params: {
                query: query,
                limit: 5
            },
            timeout: 10000
        });
        
        if (response2.data && response2.data.data && response2.data.data.results) {
            return {
                tracks: response2.data.data.results.map(track => ({
                    name: track.name,
                    artists: [{ name: track.primary_artists }],
                    duration_ms: parseInt(track.duration) * 1000,
                    url: `https://open.spotify.com/track/${track.id}`,
                    album: {
                        name: track.album,
                        images: [{ url: track.image }]
                    }
                }))
            };
        }
        
        return { tracks: [] };
    } catch (error) {
        console.error('Search error:', error.message);
        return { tracks: [] };
    }
}

async function spdl(url) {
    try {
        if (!url || !url.includes('spotify')) {
            throw new Error("URL tidak valid atau bukan link Spotify");
        }
        
        console.log("Downloading:", url);
        
        // Menggunakan endpoint alternatif untuk download
        const response = await axios.post('https://spoty-downloader2.p.rapidapi.com/spotify/dl', 
            {
                url: url
            },
            {
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY', // Ganti dengan key kamu
                    'X-RapidAPI-Host': 'spoty-downloader2.p.rapidapi.com'
                },
                timeout: 30000
            }
        );
        
        if (response.data && response.data.downloadUrl) {
            return {
                error: false,
                result: {
                    metadata: {
                        name: response.data.title || "Unknown Title",
                        artist: response.data.artist || "Unknown Artist",
                        duration_ms: parseInt(response.data.duration) * 1000 || 0
                    },
                    download: response.data.downloadUrl
                }
            };
        }
        
        throw new Error("Gagal mendapatkan link download");
        
    } catch (e) {
        console.error("SPDL Error:", e.message);
        return {
            error: true,
            msg: e.message || String(e)
        };
    }
}

// Fungsi fallback menggunakan spotmate (tetap dipertahankan)
async function spdlSpotmate(url) {
    try {
        if (!url || !url.includes('spotify')) {
            throw new Error("URL tidak valid atau bukan link Spotify");
        }
        
        const req = await axios.get("https://spotmate.online/en1", {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = req.data;
        
        const csrfMatch = html.match(
            /<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i
        );
        const token = csrfMatch?.[1];
        
        if (!token) {
            throw new Error("Gagal mendapatkan CSRF token");
        }
        
        const cookie = req.headers["set-cookie"]
            .map(v => v.split(";")[0])
            .join("; ");
        
        const sock = axios.create({
            baseURL: "https://spotmate.online",
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-csrf-token": token,
                "cookie": cookie,
                "x-requested-with": "XMLHttpRequest",
                "origin": "https://spotmate.online",
                "referer": "https://spotmate.online/en1",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        
        const meta = await sock.post(
            "/getTrackData",
            qs.stringify({
                spotify_url: url
            })
        );
        
        const conv = await sock.post(
            "/convert",
            qs.stringify({
                urls: url
            })
        );
        
        const m = meta.data;
        m.download = conv.data;
        
        if (!m?.download?.url) {
            throw new Error("Gagal mendapatkan link download");
        }
        
        return {
            scrape: "@Keigo/Izuku",
            error: false,
            result: {
                metadata: {
                    id: m.id,
                    type: m.type,
                    name: m.name,
                    duration_ms: m.duration_ms,
                    artist: m.artists,
                    album: m.album,
                    url: m.external_urls?.spotify || url
                },
                download: m.download.url
            }
        };
    } catch (e) {
        console.error("Spotmate Error:", e.message);
        return {
            error: true,
            msg: e.message || String(e)
        };
    }
}

module.exports = function(app) {
    app.get('/spotify/playspotify', async (req, res) => {
        try {
            const { query } = req.query;
            
            // Validasi parameter
            if (!query) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Parameter 'query' wajib diisi. Contoh: /spotify/playspotify?query=blinding lights",
                    data: null
                });
            }
            
            if (query.length < 2) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Query terlalu pendek (minimal 2 karakter)",
                    data: null
                });
            }
            
            console.log("Searching for:", query);
            
            // Step 1: Search lagu di Spotify
            const search = await searchSpotify(query);
            
            if (!search?.tracks?.length) {
                return res.status(404).json({
                    status: false,
                    watermark: "ARR Official",
                    error: `Track tidak ditemukan untuk query: "${query}". Coba dengan kata kunci lain.`,
                    data: null
                });
            }
            
            // Ambil hasil teratas (paling relevan)
            const topTrack = search.tracks[0];
            const spotifyUrl = topTrack.url;
            
            console.log("Found track:", topTrack.name, "URL:", spotifyUrl);
            
            // Step 2: Download lagu dari URL yang ditemukan (coba spotmate dulu)
            let dl = await spdlSpotmate(spotifyUrl);
            
            // Jika spotmate gagal, coba alternatif lain
            if (dl.error) {
                console.log("Spotmate failed, trying alternative...");
                dl = await spdl(spotifyUrl);
            }
            
            if (dl.error) {
                return res.status(500).json({
                    status: false,
                    watermark: "ARR Official",
                    error: dl.msg || "Gagal mendownload lagu. Silakan coba lagi nanti.",
                    data: null
                });
            }
            
            // Format durasi
            const duration = ms(dl.result.metadata.duration_ms || topTrack.duration_ms);
            
            // Response sukses
            res.json({
                status: true,
                watermark: "ARR Official",
                data: {
                    query: query,
                    track: {
                        name: topTrack.name,
                        artists: topTrack.artists.map(a => a.name),
                        album: topTrack.album.name,
                        duration: duration,
                        duration_ms: topTrack.duration_ms,
                        spotify_url: spotifyUrl,
                        thumbnail: topTrack.album.images[0]?.url || topTrack.album.images[0] || null
                    },
                    download_url: dl.result.download,
                    alternatives: search.tracks.slice(1, 4).map(track => ({
                        name: track.name,
                        artists: track.artists.map(a => a.name),
                        duration: ms(track.duration_ms),
                        spotify_url: track.url
                    }))
                }
            });
            
        } catch (error) {
            console.error("Spotify Play Error:", error);
            
            let errorMessage = "Terjadi kesalahan pada server";
            let statusCode = 500;
            
            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = "Endpoint atau resource tidak ditemukan";
                    statusCode = 404;
                } else if (error.response.status === 429) {
                    errorMessage = "Terlalu banyak request, coba lagi nanti";
                    statusCode = 429;
                } else {
                    errorMessage = `Server error: ${error.response.status}`;
                }
            } else if (error.request) {
                errorMessage = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
                statusCode = 503;
            }
            
            res.status(statusCode).json({
                status: false,
                watermark: "ARR Official",
                error: errorMessage,
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
                data: null
            });
        }
    });
};

module.exports.meta = {
    category: "Downloader",
    tag: "SPOTIFY_PLAY",
    endpoints: [
        {
            method: "GET",
            path: "/spotify/playspotify",
            desc: "Auto search dan download lagu Spotify paling atas (hasil teratas)",
            tryUrl: "/spotify/playspotify?query=blinding lights",
            params: [
                {
                    name: "query",
                    required: true,
                    desc: "Judul lagu atau nama artis untuk dicari dan didownload otomatis"
                }
            ],
            note: "Endpoint ini akan otomatis mencari dan mendownload hasil teratas dari pencarian",
            example: {
                request: "GET /spotify/playspotify?query=blinding lights",
                response: {
                    status: true,
                    watermark: "ARR Official",
                    data: {
                        query: "blinding lights",
                        track: {
                            name: "Blinding Lights",
                            artists: ["The Weeknd"],
                            album: "After Hours",
                            duration: "3:20",
                            spotify_url: "https://open.spotify.com/track/4V0WpAjKOV6Ea7lTGbyUcK",
                            thumbnail: "https://i.scdn.co/image/..."
                        },
                        download_url: "https://example.com/download.mp3"
                    }
                }
            }
        }
    ]
};