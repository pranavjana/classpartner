// src/services/transcriptStorage.js
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = require('docx');

class TranscriptStorage {
  constructor(dbPath = null) {
    // Use app data directory if no path specified
    const defaultPath = app
      ? path.join(app.getPath('userData'), 'transcripts.db')
      : path.join(__dirname, '../../transcripts.db');

    this.dbPath = dbPath || defaultPath;
    this.db = new Database(this.dbPath);
    this.initDatabase();

    console.log('[TranscriptStorage] Initialized at:', this.dbPath);
  }

  initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        duration INTEGER,
        segmentCount INTEGER DEFAULT 0,
        wordCount INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        text TEXT NOT NULL,
        startMs INTEGER,
        endMs INTEGER,
        timestamp INTEGER NOT NULL,
        confidence REAL,
        embedding TEXT,
        FOREIGN KEY(sessionId) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_segments_session
        ON segments(sessionId);
      CREATE INDEX IF NOT EXISTS idx_segments_timestamp
        ON segments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_startTime
        ON sessions(startTime DESC);

      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        colour TEXT,
        semester TEXT,
        metadata TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transcription_records (
        id TEXT PRIMARY KEY,
        sessionId TEXT,
        classId TEXT,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        durationMinutes INTEGER DEFAULT 0,
        wordCount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        summary TEXT,
        keyPoints TEXT,
        actionItems TEXT,
        content TEXT,
        tags TEXT,
        flagged INTEGER DEFAULT 0,
        FOREIGN KEY(sessionId) REFERENCES sessions(id),
        FOREIGN KEY(classId) REFERENCES classes(id)
      );

      CREATE INDEX IF NOT EXISTS idx_transcription_records_class
        ON transcription_records(classId);
      CREATE INDEX IF NOT EXISTS idx_transcription_records_createdAt
        ON transcription_records(createdAt DESC);

      CREATE TABLE IF NOT EXISTS class_context_sources (
        id TEXT PRIMARY KEY,
        classId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileHash TEXT NOT NULL,
        uploadedAt INTEGER NOT NULL,
        metadata TEXT,
        UNIQUE(classId, fileHash)
      );

      CREATE TABLE IF NOT EXISTS class_context_segments (
        id TEXT PRIMARY KEY,
        sourceId TEXT NOT NULL,
        classId TEXT NOT NULL,
        orderIndex INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT,
        metadata TEXT,
        FOREIGN KEY(sourceId) REFERENCES class_context_sources(id)
      );

      CREATE INDEX IF NOT EXISTS idx_context_segments_class
        ON class_context_segments(classId, orderIndex);
      CREATE INDEX IF NOT EXISTS idx_context_segments_source
        ON class_context_segments(sourceId, orderIndex);
    `);
  }

  // Session management
  createSession(sessionId) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO sessions (id, startTime)
      VALUES (?, ?)
    `);
    stmt.run(sessionId, Date.now());
    console.log('[TranscriptStorage] Created session:', sessionId);
    return sessionId;
  }

  endSession(sessionId) {
    const endTime = Date.now();

    // Get session stats
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as segmentCount,
        SUM(LENGTH(text) - LENGTH(REPLACE(text, ' ', '')) + 1) as wordCount,
        MIN(startMs) as firstSegmentMs,
        MAX(endMs) as lastSegmentMs
      FROM segments
      WHERE sessionId = ?
    `).get(sessionId);

    const startTimeResult = this.db.prepare(`
      SELECT startTime FROM sessions WHERE id = ?
    `).get(sessionId);

    const duration = startTimeResult
      ? endTime - startTimeResult.startTime
      : null;

    // Update session
    this.db.prepare(`
      UPDATE sessions
      SET endTime = ?, duration = ?, segmentCount = ?, wordCount = ?
      WHERE id = ?
    `).run(endTime, duration, stats.segmentCount, stats.wordCount || 0, sessionId);

    console.log('[TranscriptStorage] Ended session:', sessionId, 'Duration:', duration, 'ms');
    return { endTime, duration, ...stats };
  }

  getSession(sessionId) {
    return this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).get(sessionId);
  }

  getAllSessions(limit = 50) {
    return this.db.prepare(`
      SELECT * FROM sessions
      ORDER BY startTime DESC
      LIMIT ?
    `).all(limit);
  }

  // Segment operations
  saveSegment(segment, embedding = null) {
    const embeddingJson = embedding
      ? JSON.stringify(Array.from(embedding))
      : null;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO segments
      (id, sessionId, text, startMs, endMs, timestamp, confidence, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      segment.id,
      segment.sessionId,
      segment.text,
      segment.startMs || null,
      segment.endMs || null,
      segment.timestamp || Date.now(),
      segment.confidence || null,
      embeddingJson
    );
  }

  // Batch save for efficiency
  saveSegments(segments, embeddings = []) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO segments
      (id, sessionId, text, startMs, endMs, timestamp, confidence, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        const seg = items[i];
        const emb = embeddings[i]
          ? JSON.stringify(Array.from(embeddings[i]))
          : null;

        insert.run(
          seg.id,
          seg.sessionId,
          seg.text,
          seg.startMs || null,
          seg.endMs || null,
          seg.timestamp || Date.now(),
          seg.confidence || null,
          emb
        );
      }
    });

    insertMany(segments);
  }

  getSegmentsBySession(sessionId, limit = null) {
    const query = limit
      ? `SELECT * FROM segments WHERE sessionId = ? ORDER BY timestamp ASC LIMIT ?`
      : `SELECT * FROM segments WHERE sessionId = ? ORDER BY timestamp ASC`;

    const stmt = this.db.prepare(query);
    return limit ? stmt.all(sessionId, limit) : stmt.all(sessionId);
  }

  // Get full transcript as text
  getFullTranscript(sessionId, includeTimestamps = true) {
    const segments = this.getSegmentsBySession(sessionId);

    if (!includeTimestamps) {
      return segments.map(s => s.text).join(' ');
    }

    // Format with timestamps
    return segments.map(seg => {
      const startTime = seg.startMs ? this.formatTime(seg.startMs) : '--:--';
      const endTime = seg.endMs ? this.formatTime(seg.endMs) : '--:--';
      return `[${startTime} - ${endTime}] ${seg.text}`;
    }).join('\n');
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Export functions
  exportAsText(sessionId) {
    const session = this.getSession(sessionId);
    const transcript = this.getFullTranscript(sessionId, true);

    const header = session ? `
Session: ${sessionId}
Start Time: ${new Date(session.startTime).toLocaleString()}
Duration: ${this.formatTime(session.duration || 0)}
Segments: ${session.segmentCount || 0}
Words: ${session.wordCount || 0}

--- Transcript ---

` : '';

    return header + transcript;
  }

  exportAsMarkdown(sessionId) {
    const session = this.getSession(sessionId);
    const segments = this.getSegmentsBySession(sessionId);

    let md = `# Transcript: ${sessionId}\n\n`;

    if (session) {
      md += `**Start Time:** ${new Date(session.startTime).toLocaleString()}\n`;
      md += `**Duration:** ${this.formatTime(session.duration || 0)}\n`;
      md += `**Segments:** ${session.segmentCount || 0}\n`;
      md += `**Words:** ${session.wordCount || 0}\n\n`;
    }

    md += `---\n\n## Transcript\n\n`;

    segments.forEach(seg => {
      const startTime = seg.startMs ? this.formatTime(seg.startMs) : '--:--';
      const endTime = seg.endMs ? this.formatTime(seg.endMs) : '--:--';
      md += `**[${startTime} - ${endTime}]** ${seg.text}\n\n`;
    });

    return md;
  }

  exportAsJSON(sessionId) {
    const session = this.getSession(sessionId);
    const segments = this.getSegmentsBySession(sessionId);

    return JSON.stringify({
      session,
      segments: segments.map(seg => ({
        id: seg.id,
        text: seg.text,
        startMs: seg.startMs,
        endMs: seg.endMs,
        timestamp: seg.timestamp,
        confidence: seg.confidence
      }))
    }, null, 2);
  }

  async exportAsDOCX(sessionId) {
    const session = this.getSession(sessionId);
    const segments = this.getSegmentsBySession(sessionId);

    // Build document sections
    const children = [];

    // Title
    children.push(
      new Paragraph({
        text: `Transcript: ${sessionId}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
      })
    );

    // Metadata section
    if (session) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Start Time: ', bold: true }),
            new TextRun(new Date(session.startTime).toLocaleString())
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Duration: ', bold: true }),
            new TextRun(this.formatTime(session.duration || 0))
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Segments: ', bold: true }),
            new TextRun(String(session.segmentCount || 0))
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Words: ', bold: true }),
            new TextRun(String(session.wordCount || 0))
          ],
          spacing: { after: 300 }
        })
      );
    }

    // Transcript heading
    children.push(
      new Paragraph({
        text: 'Transcript',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 }
      })
    );

    // Add each segment with timestamp
    segments.forEach(seg => {
      const startTime = seg.startMs ? this.formatTime(seg.startMs) : '--:--';
      const endTime = seg.endMs ? this.formatTime(seg.endMs) : '--:--';

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${startTime} - ${endTime}] `, bold: true, color: '666666' }),
            new TextRun(seg.text)
          ],
          spacing: { after: 150 }
        })
      );
    });

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  // Vector search - load embeddings from disk
  searchSimilar(sessionId, queryEmbedding, limit = 10, excludeIds = []) {
    // Load segments with embeddings from this session
    const segments = this.db.prepare(`
      SELECT * FROM segments
      WHERE sessionId = ? AND embedding IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 1000
    `).all(sessionId);

    if (segments.length === 0) {
      return [];
    }

    // Compute cosine similarity
    const hits = [];
    for (const seg of segments) {
      if (excludeIds.includes(seg.id)) continue;

      try {
        const embedding = new Float32Array(JSON.parse(seg.embedding));
        const score = this.cosineSimilarity(queryEmbedding, embedding);
        hits.push({ score, segment: seg });
      } catch (e) {
        console.warn('[TranscriptStorage] Failed to parse embedding for segment:', seg.id);
      }
    }

    // Sort by score and return top k
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  // ---------- Class context (knowledge base) ----------
  getClassContextSourceByHash(classId, fileHash) {
    return this.db
      .prepare(`SELECT * FROM class_context_sources WHERE classId = ? AND fileHash = ?`)
      .get(classId, fileHash);
  }

  getClassContextSources(classId) {
    return this.db
      .prepare(
        `SELECT * FROM class_context_sources WHERE classId = ? ORDER BY uploadedAt DESC`
      )
      .all(classId);
  }

  createClassContextSource({ id, classId, fileName, fileHash, metadata }) {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO class_context_sources
        (id, classId, fileName, fileHash, uploadedAt, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        classId,
        fileName,
        fileHash,
        Date.now(),
        metadata ? JSON.stringify(metadata) : null
      );
    return id;
  }

  deleteClassContextSource(sourceId) {
    const deleteSegments = this.db.prepare(
      `DELETE FROM class_context_segments WHERE sourceId = ?`
    );
    const deleteSource = this.db.prepare(
      `DELETE FROM class_context_sources WHERE id = ?`
    );
    const transaction = this.db.transaction((id) => {
      deleteSegments.run(id);
      deleteSource.run(id);
    });
    transaction(sourceId);
  }

  saveClassContextSegments(sourceId, classId, segments) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO class_context_segments
      (id, sourceId, classId, orderIndex, text, embedding, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const seg of items) {
        insert.run(
          seg.id,
          sourceId,
          classId,
          seg.orderIndex,
          seg.text,
          seg.embedding ? JSON.stringify(Array.from(seg.embedding)) : null,
          seg.metadata ? JSON.stringify(seg.metadata) : null
        );
      }
    });

    insertMany(segments);
  }

  getClassContextPrimer(classId, limit = 5) {
    const rows = this.db
      .prepare(
        `SELECT id, text, orderIndex, sourceId, metadata, classId FROM class_context_segments
         WHERE classId = ?
         ORDER BY orderIndex ASC
         LIMIT ?`
      )
      .all(classId, limit);

    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      orderIndex: row.orderIndex,
      sourceId: row.sourceId,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      classId: row.classId,
    }));
  }

  searchSimilarClass(classId, queryEmbedding, limit = 10, excludeIds = []) {
    const rows = this.db
      .prepare(
        `SELECT id, sourceId, classId, orderIndex, text, metadata, embedding
         FROM class_context_segments
         WHERE classId = ? AND embedding IS NOT NULL`
      )
      .all(classId);

    if (!rows.length) return [];

    const hits = [];
    for (const row of rows) {
      if (excludeIds.includes(row.id)) continue;
      try {
        const embedding = new Float32Array(JSON.parse(row.embedding));
        const score = this.cosineSimilarity(queryEmbedding, embedding);
        hits.push({
          score,
          segment: {
            id: row.id,
            sourceId: row.sourceId,
            classId: row.classId,
            orderIndex: row.orderIndex,
            text: row.text,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
          },
        });
      } catch (error) {
        console.warn('[TranscriptStorage] Failed to parse context embedding for segment:', row.id);
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  // Delete operations
  deleteSession(sessionId) {
    this.db.prepare('DELETE FROM segments WHERE sessionId = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    console.log('[TranscriptStorage] Deleted session:', sessionId);
  }

  // ----- Class management -----
  upsertClass(classData) {
    const now = Date.now();
    const payload = {
      id: classData.id,
      code: classData.code || null,
      name: classData.name,
      colour: classData.colour || null,
      semester: classData.semester || null,
      metadata: classData.metadata ? JSON.stringify(classData.metadata) : null,
      createdAt: classData.createdAt || now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO classes (id, code, name, colour, semester, metadata, createdAt, updatedAt)
         VALUES (@id, @code, @name, @colour, @semester, @metadata, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           code=excluded.code,
           name=excluded.name,
           colour=excluded.colour,
           semester=excluded.semester,
           metadata=excluded.metadata,
           updatedAt=excluded.updatedAt`
      )
      .run(payload);

    return this.getClass(payload.id);
  }

  getClass(classId) {
    const row = this.db.prepare(`SELECT * FROM classes WHERE id = ?`).get(classId);
    return row ? this.mapClass(row) : null;
  }

  listClasses() {
    return this.db
      .prepare(`SELECT * FROM classes ORDER BY name COLLATE NOCASE ASC`)
      .all()
      .map((row) => this.mapClass(row));
  }

  deleteClass(classId) {
    const trx = this.db.transaction((id) => {
      this.db.prepare(`DELETE FROM transcription_records WHERE classId = ?`).run(id);
      this.db.prepare(`DELETE FROM classes WHERE id = ?`).run(id);
    });
    trx(classId);
  }

  // ----- Transcription record management -----
  upsertTranscriptionRecord(record) {
    const payload = {
      id: record.id,
      sessionId: record.sessionId || null,
      classId: record.classId || null,
      title: record.title,
      createdAt: record.createdAt || Date.now(),
      durationMinutes: record.durationMinutes ?? 0,
      wordCount: record.wordCount ?? 0,
      status: record.status || "draft",
      summary: record.summary || null,
      keyPoints: record.keyPoints ? JSON.stringify(record.keyPoints) : null,
      actionItems: record.actionItems ? JSON.stringify(record.actionItems) : null,
      content: record.content || record.fullText || null,
      tags: record.tags ? JSON.stringify(record.tags) : null,
      flagged: record.flagged ? 1 : 0,
    };

    this.db
      .prepare(
        `INSERT INTO transcription_records
         (id, sessionId, classId, title, createdAt, durationMinutes, wordCount, status,
          summary, keyPoints, actionItems, content, tags, flagged)
         VALUES (@id, @sessionId, @classId, @title, @createdAt, @durationMinutes, @wordCount, @status,
          @summary, @keyPoints, @actionItems, @content, @tags, @flagged)
         ON CONFLICT(id) DO UPDATE SET
          sessionId=excluded.sessionId,
          classId=excluded.classId,
          title=excluded.title,
          durationMinutes=excluded.durationMinutes,
          wordCount=excluded.wordCount,
          status=excluded.status,
          summary=excluded.summary,
          keyPoints=excluded.keyPoints,
          actionItems=excluded.actionItems,
          content=excluded.content,
          tags=excluded.tags,
          flagged=excluded.flagged`
      )
      .run(payload);

    return this.getTranscriptionRecord(payload.id);
  }

  getTranscriptionRecord(id) {
    const row = this.db.prepare(`SELECT * FROM transcription_records WHERE id = ?`).get(id);
    return row ? this.mapTranscriptionRecord(row) : null;
  }

  listTranscriptionRecords({ classId = null, limit = 100 } = {}) {
    const stmt = classId
      ? this.db.prepare(
          `SELECT * FROM transcription_records WHERE classId = ?
           ORDER BY createdAt DESC LIMIT ?`
        )
      : this.db.prepare(
          `SELECT * FROM transcription_records
           ORDER BY createdAt DESC LIMIT ?`
        );
    const rows = classId ? stmt.all(classId, limit) : stmt.all(limit);
    return rows.map((row) => this.mapTranscriptionRecord(row));
  }

  deleteTranscriptionRecord(id) {
    this.db.prepare(`DELETE FROM transcription_records WHERE id = ?`).run(id);
  }

  // ----- Helpers -----
  mapClass(row) {
    return {
      id: row.id,
      code: row.code || undefined,
      name: row.name,
      colour: row.colour || undefined,
      semester: row.semester || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  mapTranscriptionRecord(row) {
    return {
      id: row.id,
      sessionId: row.sessionId || undefined,
      classId: row.classId || undefined,
      title: row.title,
      createdAt: row.createdAt,
      durationMinutes: row.durationMinutes ?? 0,
      wordCount: row.wordCount ?? 0,
      status: row.status,
      summary: row.summary || undefined,
      keyPoints: row.keyPoints ? JSON.parse(row.keyPoints) : undefined,
      actionItems: row.actionItems ? JSON.parse(row.actionItems) : undefined,
      content: row.content || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      flagged: Boolean(row.flagged),
      fullText: row.content || undefined,
    };
  }

  // Stats and diagnostics
  getStats() {
    const stats = this.db.prepare(`
      SELECT
        COUNT(DISTINCT sessionId) as totalSessions,
        COUNT(*) as totalSegments,
        SUM(LENGTH(text)) as totalChars
      FROM segments
    `).get();

    return {
      ...stats,
      dbSize: this.getDbSize(),
      dbPath: this.dbPath
    };
  }

  getDbSize() {
    const fs = require('fs');
    try {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch (e) {
      return 0;
    }
  }

  // Cleanup
  close() {
    this.db.close();
    console.log('[TranscriptStorage] Database closed');
  }
}

module.exports = TranscriptStorage;
