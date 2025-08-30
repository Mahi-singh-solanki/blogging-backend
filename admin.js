const mongoose = require("mongoose");
const express = require("express");
const { authenticateJWT, verifyAdmin } = require("./auth");
const { Blog, Analytics } = require("./blog");
const router = express.Router();

router.get("/admin/blogs", authenticateJWT, verifyAdmin, async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "pending" }).sort({
      createdAt: -1,
    });
    if (!blogs.length)
      return res.json({ message: "No blogs available for pending" });
    res.json({
      count: blogs.length,
      blogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server not available" });
  }
});

router.put(
  "/admin/blogs/:id/approve",
  authenticateJWT,
  verifyAdmin,
  async (req, res) => {
    try {
      const blog = await Blog.findById(req.params.id);
      if (!blog) res.status(204).json({ message: "Blog not available" });
      blog.status = "approved";
      await blog.save();
      res.status(200).json({ message: "Blog approved succesfully", blog });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server not available" });
    }
  }
);

router.put(
  "/admin/blogs/:id/reject",
  authenticateJWT,
  verifyAdmin,
  async (req, res) => {
    try {
      const blog = await Blog.findById(req.params.id);
      if (!blog) return res.status(404).json({ message: "Blog not available" });
      blog.status = "rejected";
      await blog.save();
      res.status(200).json({ message: "Blog rejected succesfully", blog });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server not available" });
    }
  }
);

router.put(
  "/admin/blogs/:id/hide",
  authenticateJWT,
  verifyAdmin,
  async (req, res) => {
    try {
      const blog = await Blog.findById(req.params.id);
      if (!blog) res.status(204).json({ message: "Blog not available" });
      if (blog.status !== "approved") {
        return res
          .status(403)
          .json({ error: "you can only hide approved blogs" });
      }
      blog.status = "hidden";
      await blog.save();
      res.status(200).json({ message: "Blog hidden succesfully", blog });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server not available" });
    }
  }
);

router.get(
  "/analytics/blogs/:id",
  authenticateJWT,
  verifyAdmin,
  async (req, res) => {
    try {
      const blog = await Blog.findById(req.params.id);
      const analytics = await Analytics.findOne({ blog: req.params.id });
      if (!blog) res.status(204).json({ message: "Blog not available" });
      console.log(analytics.views);
      const stats = {
        views: analytics.views || 0,
        like: blog.likes.length || 0,
        comments: blog.comments.length || 0,
      };
      res.json({
        blogId: blog._id,
        title: blog.title,
        stats,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server not available" });
    }
  }
);

router.get(
  "/analytics/user/:id",
  authenticateJWT,
  verifyAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const blogs = await Blog.find({ author: req.params.id });
      const analytics = await Analytics.find({ user: req.params.id });
      if (!blogs.length) {
        return res.status(404).json({ error: "User has no blogs" });
      }
      const totalBlogs = blogs.length;
      const totalViews = analytics.reduce(
        (acc, blog) => acc + (blog.views || 0),
        0
      );
      const totalLikes = blogs.reduce(
        (acc, blog) => acc + (blog.likes.length || 0),
        0
      );
      const avgLikes = totalLikes / totalBlogs;
      res.json({
        userId,
        totalBlogs,
        totalViews,
        avgLikes,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server not available" });
    }
  }
);

module.exports = { router };
