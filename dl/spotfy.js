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

// Fungsi untuk search Spotify menggunakan web scraping
async function searchSpotify(query) {
    try {
        // Method 1: Menggunakan API search dari spotify-down
        const response = await axios.get('https://spotify-down.com/api/search', {
            params: {
                q: query,
                type: 'track',
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
                    artists: track.artists || [{ name: track.artist || "Unknown" }],
                    duration_ms: (track.duration || 0) * 1000,
                    url: track.url || `https://open.spotify.com/track/${track.id}`,
                    album: {
                        name: track.album || "Unknown Album",
                        images: [{ url: track.cover || track.thumbnail || "" }]
                    }
                }))
            };
        }
        
        // Method 2: Menggunakan API dari spotify-api.com
        const response2 = await axios.get('https://spotify-api.com/api/v1/search', {
            params: {
                q: query,
                limit: 5
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response2.data && response2.data.tracks && response2.data.tracks.length > 0) {
            return {
                tracks: response2.data.tracks.map(track => ({
                    name: track.title,
                    artists: [{ name: track.artist }],
                    duration_ms: track.duration * 1000,
                    url: track.url,
                    album: {
                        name: track.album,
                        images: [{ url: track.thumbnail }]
                    }
                }))
            };
        }
        
        // Method 3: Menggunakan API dari saavn (India)
        const response3 = await axios.get('https://saavn.me/search/songs', {
            params: {
                query: query,
                limit: 5
            },
            timeout: 10000
        });
        
        if (response3.data && response3.data.data && response3.data.data.results && response3.data.data.results.length > 0) {
            return {
                tracks: response3.data.data.results.map(track => ({
                    name: track.name,
                    artists: [{ name: track.primary_artists || track.artist }],
                    duration_ms: parseFloat(track.duration) * 1000,
                    url: `https://open.spotify.com/track/${track.id}`,
                    album: {
                        name: track.album || "Unknown",
                        images: [{ url: track.image || track.thumbnail }]
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

// Fungsi utama download dari spotmate
async function spdl(url) {
    try {
        if (!url || !url.includes('spotify')) {
            throw new Error("URL tidak valid atau bukan link Spotify");
        }
        
        console.log("Starting download for:", url);
        
        // Request ke halaman utama untuk mendapatkan token
        const req = await axios.get("https://spotmate.online/en1", {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            }
        });
        
        const html = req.data;
        
        // Extract CSRF token
        const csrfMatch = html.match(
            /<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i
        );
        const token = csrfMatch?.[1];
        
        if (!token) {
            throw new Error("Gagal mendapatkan CSRF token");
        }
        
        // Extract cookie
        const cookie = req.headers["set-cookie"]
            .map(v => v.split(";")[0])
            .join("; ");
        
        console.log("Got token and cookie");
        
        // Create axios instance with headers
        const sock = axios.create({
            baseURL: "https://spotmate.online",
            timeout: 20000,
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
        
        // Get track data
        console.log("Getting track data...");
        const meta = await sock.post(
            "/getTrackData",
            qs.stringify({
                spotify_url: url
            })
        );
        
        // Convert track
        console.log("Converting track...");
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
        
        console.log("Download URL obtained:", m.download.url);
        
        return {
            scrape: "@Keigo/Izuku",
            error: false,
            result: {
                metadata: {
                    id: m.id,
                    type: m.type,
                    name: m.name || "Unknown Title",
                    duration_ms: m.duration_ms || 0,
                    artist: m.artists || "Unknown Artist",
                    album: m.album || "Unknown Album",
                    url: m.external_urls?.spotify || url
                },
                download: m.download.url
            }
        };
    } catch (e) {
        console.error("SPDL Error:", e.message);
        if (e.response) {
            console.error("Response status:", e.response.status);
            console.error("Response data:", e.response.data);
        }
        return {
            error: true,
            msg: e.message || String(e)
        };
    }
}

module.exports = function(app) {
    app.get('/spotify/playspotify', async (req, res) => {
        try {
            let { query, url } = req.query;
            
            // Validasi parameter: harus ada query ATAU url
            if (!query && !url) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Parameter 'query' atau 'url' wajib diisi. Contoh: /spotify/playspotify?query=budapest atau /spotify/playspotify?url=https://open.spotify.com/track/xxx",
                    data: null
                });
            }
            
            let spotifyUrl = url;
            let trackInfo = null;
            
            // Jika menggunakan query, cari lagu terlebih dahulu
            if (query && !url) {
                if (query.length < 2) {
                    return res.status(400).json({
                        status: false,
                        watermark: "ARR Official",
                        error: "Query terlalu pendek (minimal 2 karakter)",
                        data: null
                    });
                }
                
                console.log("Searching for:", query);
                
                const search = await searchSpotify(query);
                
                if (!search?.tracks?.length) {
                    return res.status(404).json({
                        status: false,
                        watermark: "ARR Official",
                        error: `Track tidak ditemukan untuk query: "${query}". Coba dengan kata kunci lain seperti: "shape of you", "blinding lights", "perfect"`,
                        data: null,
                        suggestion: "Coba gunakan parameter 'url' langsung jika Anda memiliki link Spotify: /spotify/playspotify?url=https://open.spotify.com/track/xxx"
                    });
                }
                
                trackInfo = search.tracks[0];
                spotifyUrl = trackInfo.url;
                console.log("Found track:", trackInfo.name, "-", trackInfo.artists[0].name);
            }
            
            // Validasi URL Spotify
            if (!spotifyUrl || !spotifyUrl.includes('spotify.com/track/')) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "URL Spotify tidak valid. Pastikan URL adalah link track Spotify",
                    data: null,
                    example: "https://open.spotify.com/track/4V0WpAjKOV6Ea7lTGbyUcK"
                });
            }
            
            console.log("Downloading from:", spotifyUrl);
            
            // Download lagu
            const dl = await spdl(spotifyUrl);
            
            if (dl.error) {
                return res.status(500).json({
                    status: false,
                    watermark: "ARR Official",
                    error: dl.msg || "Gagal mendownload lagu. Silakan coba lagi nanti.",
                    data: null,
                    note: "Jika error terus terjadi, coba gunakan link Spotify yang berbeda"
                });
            }
            
            // Format durasi
            const duration = ms(dl.result.metadata.duration_ms);
            
            // Response sukses
            const responseData = {
                query: query || null,
                download_url: dl.result.download,
                metadata: {
                    title: dl.result.metadata.name,
                    artist: dl.result.metadata.artist,
                    album: dl.result.metadata.album,
                    duration: duration,
                    spotify_url: spotifyUrl
                }
            };
            
            // Tambahkan info track jika dari search
            if (trackInfo) {
                responseData.track_info = {
                    name: trackInfo.name,
                    artists: trackInfo.artists.map(a => a.name),
                    album: trackInfo.album.name,
                    thumbnail: trackInfo.album.images[0]?.url || null
                };
            }
            
            res.json({
                status: true,
                watermark: "ARR Official",
                data: responseData
            });
            
        } catch (error) {
            console.error("Spotify Play Error:", error);
            
            let errorMessage = "Terjadi kesalahan pada server";
            let statusCode = 500;
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = "Request timeout. Server terlalu lambat merespon.";
                statusCode = 504;
            } else if (error.response) {
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
                errorMessage = "Tidak dapat terhubung ke server spotmate.online. Cek koneksi internet Anda.";
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
            tryUrl: "/spotify/playspotify?query=budapest",
            params: [
                {
                    name: "query",
                    required: false,
                    desc: "Judul lagu atau nama artis untuk dicari"
                },
                {
                    name: "url",
                    required: false,
                    desc: "URL langsung Spotify (alternatif dari query)"
                }
            ],
            note: "Gunakan salah satu parameter (query atau url). Untuk hasil terbaik, gunakan parameter 'url' langsung.",
            example: {
                by_query: "/spotify/playspotify?query=budapest",
                by_url: "/spotify/playspotify?url=https://open.spotify.com/track/4V0WpAjKOV6Ea7lTGbyUcK"
            }
        }
    ]
};