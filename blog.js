const mongoose = require("mongoose");
const express = require("express");
const { authenticateJWT } = require("./auth");
const router = express.Router();

const Blog = mongoose.model(
  "Blog",
  new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "hidden"],
      default: "pending",
    },
    tags: [String],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    views: { type: mongoose.Schema.Types.ObjectId, ref: "Analytics" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  })
);

const Comment = mongoose.model(
  "Comment",
  new mongoose.Schema({
    blog: { type: mongoose.Schema.Types.ObjectId, ref: "Blog", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  })
);

const Analytics = mongoose.model(
  "Analytics",
  new mongoose.Schema({
    blog: { type: mongoose.Schema.Types.ObjectId, ref: "Blog", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    views: { type: Number, default: 0 },
    lastViewed: { type: Date },
  })
);

router.post("/blogs", authenticateJWT, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!title || !content)
      res.status(400).json({ error: "Title and content needed" });
    const blog = new Blog({
      title: title,
      content: content,
      tags: tags,
      author: req.user._id,
    });
    await blog.save();
    res.status(200).json({ message: "Blog created suucesfully", blog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.get("/blogs/my", authenticateJWT, async (req, res) => {
  try {
    const blogs = await Blog.find({ author: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({
      count: blogs.length,
      blogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.put("/blogs/:id", authenticateJWT, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid blog ID" });
    }
    const { title, content, tags } = req.body;
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "blog not found" });
    if (blog.author.toString() !== req.user._id.toString())
      return res.status(400).json({ error: "You are not the author" });
    if (blog.status !== "pending")
      return res.status(400).json({ error: "you can only edit pending blogs" });
    if (title) blog.title = title;
    if (content) blog.content = content;
    if (tags) blog.tags = tags;
    blog.updatedAt = Date.now();
    await blog.save();
    res.status(200).json({ message: "Blog update successfully", blog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.delete("/blogs/:id", authenticateJWT, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "blog not found" });
    if (blog.author.toString() !== req.user._id.toString())
      return res.status(401).json({ error: "Not authorized" });
    await blog.deleteOne();
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.get("/blogs", async (req, res) => {
  try {
    const { tags, search } = req.query;
    let query = { status: "approved" };
    if (tags) query.tags = tags;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }
    const blogs = await Blog.find(query)
      .populate("author", "username email") // only show basic author info
      .sort({ createdAt: -1 });
    res.json({
      count: blogs.length,
      blogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.get("/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate("author", "username")
      .populate("comments");
    if (!blog) return res.status(404).json({ error: "blog not found" });
    if (blog.status !== "approved") {
      return res.status(403).json({ error: "This blog is not public" });
    }
    let analytics = await Analytics.findOne({ blog: blog._id });
    if (!analytics) {
      analytics = new Analytics({
        user: blog.author,
        blog: blog._id,
        views: 1,
        lastViewed: new Date(),
      });
    } else {
      analytics.views += 1;
      analytics.lastViewed = new Date();
    }
    await analytics.save();

    res.json({
      id: blog._id,
      title: blog.title,
      content: blog.content,
      tags: blog.tags,
      author: blog.author,
      likesCount: blog.likes.length,
      commentsCount: blog.comments.length,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
      views: analytics.views,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.post("/blogs/:id/comments", authenticateJWT, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content)
      return res.status(400).json({ error: "Comment content is required" });

    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    if (blog.status !== "approved") {
      return res
        .status(403)
        .json({ error: "Cannot comment on non-public blogs" });
    }
    const comment = new Comment({
      blog: blog._id,
      user: req.user._id,
      content,
    });
    await comment.save();

    blog.comments.push(comment._id);
    await blog.save();

    res.status(201).json({
      message: "Comment added successfully",
      comment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.get("/blogs/:id/comments", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "blog not found" });
    if (blog.status !== "approved") {
      return res.status(403).json({ error: "This blog is not public" });
    }
    const comments = await Comment.find({ blog: blog._id })
      .populate("user", "username")
      .sort({ createdAt: -1 });
    res.json({
      count: comments.length,
      comments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

router.post("/blogs/:id/like", authenticateJWT, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    if (blog.status !== "approved") {
      return res
        .status(403)
        .json({ error: "You can only like approved blogs" });
    }

    const userId = req.user._id;
    const alreadyLiked = blog.likes.includes(userId);

    if (alreadyLiked) {
      // Unlike
      blog.likes = blog.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
      await blog.save();
      return res.json({
        message: "Unliked blog",
        likesCount: blog.likes.length,
      });
    } else {
      // Like
      blog.likes.push(userId);
      await blog.save();
      return res.json({ message: "Liked blog", likesCount: blog.likes.length });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server connection error" });
  }
});

module.exports = { router, Blog, Analytics };
