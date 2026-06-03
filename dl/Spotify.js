/**
 * @author      ARR Official
 * @title       Spotify Downloader API
 * @description API untuk mencari dan mendownload lagu dari Spotify melalui spotmate.online
 * @baseurl     https://spotmate.online
 * @tags        downloader, music, spotify, audio
 * @language    javascript
 */

const axios = require('axios');
const qs = require('qs');

// Fungsi konversi milliseconds ke format menit:detik
function ms(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Fungsi untuk search Spotify (tanpa library spotify-clients)
async function searchSpotify(query) {
    try {
        // Menggunakan API search Spotify langsung
        const response = await axios.get('https://api.spotify.com/v1/search', {
            params: {
                q: query,
                type: 'track',
                limit: 5
            },
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (!response.data.tracks?.items?.length) {
            return { tracks: [] };
        }
        
        return {
            tracks: response.data.tracks.items.map(track => ({
                name: track.name,
                artists: track.artists.map(artist => ({ name: artist.name })),
                duration_ms: track.duration_ms,
                url: track.external_urls.spotify,
                album: {
                    name: track.album.name,
                    images: track.album.images
                }
            }))
        };
    } catch (error) {
        console.error('Search error:', error.message);
        return { tracks: [] };
    }
}

async function spdl(url) {
    try {
        if (!url?.includes('spotify')) throw new Error("URL tidak valid atau bukan link Spotify");
        
        const req = await axios.get("https://spotmate.online/en1");
        const html = req.data;
        
        const csrfMatch = html.match(
            /<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i
        );
        const token = csrfMatch?.[1];
        
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
                "user-agent": "Mozilla/5.0"
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
        return {
            error: true,
            msg: e.message || e
        };
    }
}

module.exports = function(app) {
    // Endpoint 1: Search Spotify
    app.get('/spotify/search', async (req, res) => {
        try {
            const { query } = req.query;
            
            if (!query) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Parameter 'query' wajib diisi",
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
            
            const search = await searchSpotify(query);
            
            if (!search?.tracks?.length) {
                return res.status(404).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Track tidak ditemukan",
                    data: null
                });
            }
            
            const results = search.tracks.map(track => ({
                name: track.name,
                artists: track.artists.map(a => a.name),
                duration: ms(track.duration_ms),
                duration_ms: track.duration_ms,
                url: track.url,
                album: track.album.name,
                thumbnail: track.album.images[0]?.url || null
            }));
            
            res.json({
                status: true,
                watermark: "ARR Official",
                data: {
                    query: query,
                    total: results.length,
                    results: results
                }
            });
            
        } catch (error) {
            console.error("Search error:", error);
            res.status(500).json({
                status: false,
                watermark: "ARR Official",
                error: "Gagal melakukan pencarian",
                data: null
            });
        }
    });
    
    // Endpoint 2: Download Spotify by URL
    app.get('/spotify/download', async (req, res) => {
        try {
            const { url } = req.query;
            
            // Validasi parameter
            if (!url) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Parameter 'url' wajib diisi",
                    data: null
                });
            }
            
            // Validasi URL Spotify
            if (!url || !url.includes('spotify.com/track/')) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "URL Spotify tidak valid. Pastikan URL adalah link track Spotify",
                    data: null
                });
            }
            
            // Download lagu
            const dl = await spdl(url);
            
            if (dl.error) {
                return res.status(500).json({
                    status: false,
                    watermark: "ARR Official",
                    error: dl.msg || "Gagal mendownload lagu",
                    data: null
                });
            }
            
            // Format durasi
            const duration = ms(dl.result.metadata.duration_ms || 0);
            
            // Response sukses
            res.json({
                status: true,
                watermark: "ARR Official",
                data: {
                    metadata: {
                        id: dl.result.metadata.id,
                        type: dl.result.metadata.type,
                        name: dl.result.metadata.name,
                        artist: dl.result.metadata.artist,
                        album: dl.result.metadata.album,
                        duration: duration,
                        duration_ms: dl.result.metadata.duration_ms,
                        url: dl.result.metadata.url
                    },
                    download_url: dl.result.download
                }
            });
            
        } catch (error) {
            console.error("Spotify Download Error:", error);
            
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
                errorMessage = "Tidak dapat terhubung ke server spotmate.online";
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
    
    // Endpoint 3: Play - Auto search and download top result
    app.get('/spotify/play', async (req, res) => {
        try {
            const { query } = req.query;
            
            // Validasi parameter
            if (!query) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Parameter 'query' wajib diisi",
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
            
            // Step 1: Search lagu di Spotify
            const search = await searchSpotify(query);
            
            if (!search?.tracks?.length) {
                return res.status(404).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "Track tidak ditemukan",
                    data: null
                });
            }
            
            // Ambil hasil teratas (paling relevan)
            const topTrack = search.tracks[0];
            const spotifyUrl = topTrack.url;
            
            // Step 2: Download lagu dari URL yang ditemukan
            const dl = await spdl(spotifyUrl);
            
            if (dl.error) {
                return res.status(500).json({
                    status: false,
                    watermark: "ARR Official",
                    error: dl.msg || "Gagal mendownload lagu",
                    data: null
                });
            }
            
            // Format durasi
            const duration = ms(dl.result.metadata.duration_ms || topTrack.duration_ms);
            
            // Response sukses dengan informasi lengkap
            res.json({
                status: true,
                watermark: "ARR Official",
                data: {
                    query: query,
                    matched_track: {
                        name: topTrack.name,
                        artists: topTrack.artists.map(a => a.name),
                        album: topTrack.album.name,
                        duration: duration,
                        duration_ms: topTrack.duration_ms,
                        spotify_url: spotifyUrl,
                        thumbnail: topTrack.album.images[0]?.url || null
                    },
                    download: {
                        url: dl.result.download,
                        metadata: {
                            id: dl.result.metadata.id,
                            type: dl.result.metadata.type,
                            quality: "MP3 (320kbps)",
                            size: dl.result.metadata.size || "Unknown"
                        }
                    },
                    alternative_results: search.tracks.slice(1, 4).map(track => ({
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
                errorMessage = "Tidak dapat terhubung ke server spotmate.online";
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
    tag: "SPOTIFY_DOWNLOADER",
    endpoints: [
        {
            method: "GET",
            path: "/spotify/search",
            desc: "Mencari lagu di Spotify tanpa download",
            tryUrl: "/spotify/search?query=blinding lights",
            params: [
                {
                    name: "query",
                    required: true,
                    desc: "Judul lagu atau nama artis yang dicari"
                }
            ],
            example: {
                request: "GET /spotify/search?query=blinding lights",
                response: {
                    status: true,
                    watermark: "ARR Official",
                    data: {
                        query: "blinding lights",
                        total: 5,
                        results: [
                            {
                                name: "Blinding Lights",
                                artists: ["The Weeknd"],
                                duration: "3:20",
                                url: "https://open.spotify.com/track/..."
                            }
                        ]
                    }
                }
            }
        },
        {
            method: "GET",
            path: "/spotify/download",
            desc: "Download lagu dari Spotify menggunakan URL langsung",
            tryUrl: "/spotify/download?url=https://open.spotify.com/track/4V0WpAjKOV6Ea7lTGbyUcK",
            params: [
                {
                    name: "url",
                    required: true,
                    desc: "URL langsung track Spotify"
                }
            ],
            example: {
                request: "GET /spotify/download?url=https://open.spotify.com/track/4V0WpAjKOV6Ea7lTGbyUcK",
                response: {
                    status: true,
                    watermark: "ARR Official",
                    data: {
                        metadata: {
                            name: "Blinding Lights",
                            artist: "The Weeknd",
                            album: "After Hours",
                            duration: "3:20",
                            url: "https://open.spotify.com/track/..."
                        },
                        download_url: "https://example.com/download.mp3"
                    }
                }
            }
        },
        {
            method: "GET",
            path: "/spotify/play",
            desc: "Auto search dan download lagu Spotify paling atas (hasil teratas)",
            tryUrl: "/spotify/play?query=blinding lights",
            params: [
                {
                    name: "query",
                    required: true,
                    desc: "Judul lagu atau nama artis untuk dicari dan didownload otomatis"
                }
            ],
            note: "Endpoint ini akan otomatis mencari dan mendownload hasil teratas dari pencarian",
            example: {
                request: "GET /spotify/play?query=blinding lights",
                response: {
                    status: true,
                    watermark: "ARR Official",
                    data: {
                        query: "blinding lights",
                        matched_track: {
                            name: "Blinding Lights",
                            artists: ["The Weeknd"],
                            album: "After Hours",
                            duration: "3:20",
                            spotify_url: "https://open.spotify.com/track/...",
                            thumbnail: "https://i.scdn.co/image/..."
                        },
                        download: {
                            url: "https://example.com/download.mp3",
                            metadata: {
                                quality: "MP3 (320kbps)"
                            }
                        },
                        alternative_results: [...]
                    }
                }
            }
        }
    ]
};