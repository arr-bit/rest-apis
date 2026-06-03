/**
 * @author      ARR Official
 * @title       SaveFBS Video Downloader API
 * @description API untuk mendownload video dari berbagai platform (TikTok, Instagram, Facebook, dll) menggunakan savefbs.com
 * @baseurl     https://savefbs.com
 * @tags        downloader, video, social-media
 * @language    javascript
 */

const axios = require("axios");
const cheerio = require("cheerio");

const API = "https://savefbs.com/api/v1/aio/html";

async function getVideoData(videoUrl) {
  const { data: html } = await axios.post(
    API,
    {
      vid: videoUrl,
      prefix: "savefbs.com",
      ex: "",
      format: ""
    },
    {
      headers: {
        "content-type": "application/json",
        referer: "https://savefbs.com/all-in-one-video-downloader/",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/137 Mobile Safari/537.36"
      }
    }
  );

  const $ = cheerio.load(html);

  // ===== BASIC INFO =====
  const title = $("h3.text-sm").text().trim() || null;
  const description =
    $(".text-gray-700").text().trim() ||
    $(".text-gray-600").text().trim() ||
    null;

  const owner =
    $("p.text-gray-600")
      .first()
      .text()
      .replace("Owner:", "")
      .trim() || null;

  const thumbnail = $("img.aio-thumbnail").attr("src") || null;

  // ===== DOWNLOAD LINKS =====
  const downloads = [];

  $("a.download-btn").each((_, el) => {
    const url = $(el).attr("href");
    const label = $(el).text().trim();

    if (url) {
      downloads.push({
        type: label,
        url
      });
    }
  });

  // ===== RESULT =====
  const result = {
    title,
    description,
    owner,
    thumbnail,
    downloads
  };

  return result;
}

module.exports = function(app) {
  app.get('/savefbs/download', async (req, res) => {
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

      // Validasi format URL
      const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlPattern.test(url)) {
        return res.status(400).json({
          status: false,
          watermark: "ARR Official",
          error: "Format URL tidak valid",
          data: null
        });
      }

      // Panggil fungsi scraping
      const result = await getVideoData(url);

      // Cek apakah data ditemukan
      if (!result.downloads || result.downloads.length === 0) {
        return res.status(404).json({
          status: false,
          watermark: "ARR Official",
          error: "Tidak ada link download yang ditemukan",
          data: null
        });
      }

      // Response sukses
      res.json({
        status: true,
        watermark: "ARR Official",
        data: result
      });

    } catch (error) {
      console.error("Error:", error.message);

      // Handling error berdasarkan tipe error
      let errorMessage = "Terjadi kesalahan pada server";
      let statusCode = 500;

      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = "Endpoint API tidak ditemukan";
          statusCode = 404;
        } else if (error.response.status === 403) {
          errorMessage = "Akses ditolak oleh server";
          statusCode = 403;
        } else {
          errorMessage = `Server error: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = "Tidak dapat terhubung ke server";
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
  tag: "VIDEO_DOWNLOADER",
  endpoints: [
    {
      method: "GET",
      path: "/savefbs/download",
      desc: "Download video dari berbagai platform (TikTok, Instagram, Facebook, Twitter, dll) menggunakan savefbs.com",
      tryUrl: "/savefbs/download?url=https://vt.tiktok.com/ZSx4HhBh8/",
      params: [
        {
          name: "url",
          required: true,
          desc: "URL video yang ingin didownload (support TikTok, Instagram, Facebook, Twitter, dll)"
        }
      ],
      example: {
        request: "GET /savefbs/download?url=https://vt.tiktok.com/ZSx4HhBh8/",
        response: {
          status: true,
          watermark: "ARR Official",
          data: {
            title: "Video Title",
            description: "Video Description",
            owner: "Username",
            thumbnail: "https://example.com/thumbnail.jpg",
            downloads: [
              {
                type: "Download Video (HD)",
                url: "https://example.com/video.mp4"
              }
            ]
          }
        }
      }
    }
  ]
};