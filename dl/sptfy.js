/**
 * @author      ARR Official
 * @title       Spotify Play API
 * @description API untuk search dan download lagu dari Spotify menggunakan spotdown.org
 * @baseurl     https://spotdown.org
 * @tags        downloader, music, spotify, audio
 * @language    javascript
 */

const axios = require('axios');

// Fungsi konversi duration string ke milliseconds
function durationToMs(duration) {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 2) {
        const [min, sec] = parts;
        return (min * 60 + sec) * 1000;
    } else if (parts.length === 3) {
        const [hour, min, sec] = parts;
        return (hour * 3600 + min * 60 + sec) * 1000;
    }
    return 0;
}

// Fungsi untuk mencari lagu di Spotify
async function searchSpotify(query) {
    try {
        const response = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(query)}`, {
            headers: {
                'origin': 'https://spotdown.org',
                'referer': 'https://spotdown.org/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            },
            timeout: 15000
        });

        const song = response.data?.songs?.[0];
        if (!song) return null;

        return {
            title: song.title,
            artist: song.artist,
            duration: song.duration,
            thumbnail: song.thumbnail,
            url: song.url
        };
    } catch (error) {
        console.error('Search error:', error.message);
        return null;
    }
}

// Fungsi untuk download lagu
async function downloadSpotify(songUrl) {
    try {
        const response = await axios.post('https://spotdown.org/api/download', {
            url: songUrl
        }, {
            headers: {
                'origin': 'https://spotdown.org',
                'referer': 'https://spotdown.org/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            },
            responseType: 'arraybuffer',
            timeout: 30000
        });

        return response.data;
    } catch (error) {
        console.error('Download error:', error.message);
        return null;
    }
}

module.exports = function(app) {
    /**
     * ENDPOINT SPOTIFY PLAY
     * Mencari lagu dan mendapatkan link download
     * Contoh: /spotify/playspotify?query=blinding lights
     */
    app.get('/spotify/playspotify', async (req, res) => {
        try {
            const { query } = req.query;

            // Validasi parameter
            if (!query) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "❌ Parameter 'query' wajib diisi!",
                    cara_pakai: "/spotify/playspotify?query=nama lagu",
                    contoh: "/spotify/playspotify?query=blinding lights",
                    data: null
                });
            }

            if (query.length < 2) {
                return res.status(400).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "❌ Query terlalu pendek (minimal 2 karakter)",
                    data: null
                });
            }

            console.log(`🔍 Searching: "${query}"`);

            // STEP 1: SEARCH LAGU
            const song = await searchSpotify(query);

            if (!song) {
                return res.status(404).json({
                    status: false,
                    watermark: "ARR Official",
                    error: `❌ Lagu "${query}" tidak ditemukan`,
                    saran: "Coba dengan kata kunci lain seperti: shape of you, blinding lights, perfect",
                    data: null
                });
            }

            console.log(`✅ Found: ${song.title} - ${song.artist}`);

            // STEP 2: DOWNLOAD LAGU
            console.log(`📥 Downloading...`);
            const audioBuffer = await downloadSpotify(song.url);

            if (!audioBuffer) {
                return res.status(500).json({
                    status: false,
                    watermark: "ARR Official",
                    error: "❌ Gagal mendownload lagu",
                    saran: "Silakan coba lagi nanti",
                    data: null
                });
            }

            // Konversi duration
            const durationMs = durationToMs(song.duration);
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Convert audio buffer ke base64 untuk response JSON
            const audioBase64 = audioBuffer.toString('base64');

            // RESPONSE SUKSES
            res.json({
                status: true,
                watermark: "ARR Official",
                data: {
                    query: query,
                    metadata: {
                        title: song.title,
                        artist: song.artist,
                        album: song.album || "Unknown Album",
                        duration: song.duration,
                        duration_formatted: formattedDuration,
                        duration_ms: durationMs,
                        thumbnail: song.thumbnail,
                        spotify_url: song.url
                    },
                    audio: {
                        base64: audioBase64,
                        size: audioBuffer.length,
                        mimetype: "audio/mpeg"
                    },
                    download_info: {
                        message: "Audio dalam format base64. Untuk menyimpan sebagai file MP3, decode base64 ke binary.",
                        suggested_filename: `${song.title} - ${song.artist}.mp3`
                    }
                }
            });

        } catch (error) {
            console.error("Spotify Play Error:", error);
            res.status(500).json({
                status: false,
                watermark: "ARR Official",
                error: "Terjadi kesalahan pada server: " + error.message,
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
            desc: "Search dan download lagu Spotify (PLAY = search + download otomatis)",
            tryUrl: "/spotify/playspotify?query=blinding lights",
            params: [
                {
                    name: "query",
                    required: true,
                    desc: "Judul lagu atau nama artis yang ingin dicari dan didownload"
                }
            ],
            example: {
                request: "GET /spotify/playspotify?query=blinding lights",
                response: {
                    status: true,
                    watermark: "ARR Official",
                    data: {
                        query: "blinding lights",
                        metadata: {
                            title: "Blinding Lights",
                            artist: "The Weeknd",
                            duration: "3:20",
                            duration_formatted: "3:20",
                            thumbnail: "https://example.com/thumb.jpg",
                            spotify_url: "https://open.spotify.com/track/xxx"
                        },
                        audio: {
                            base64: "SUQzBAAAAAABEVRYWFgAAA...",
                            size: 5242880,
                            mimetype: "audio/mpeg"
                        }
                    }
                }
            }
        }
    ]
};