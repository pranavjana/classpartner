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

      CREATE TABLE IF NOT EXISTS qa_interactions (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        recordId TEXT,
        timestamp INTEGER NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        context TEXT,
        markerMs INTEGER,
        metadata TEXT,
        FOREIGN KEY(sessionId) REFERENCES sessions(id),
        FOREIGN KEY(recordId) REFERENCES transcription_records(id)
      );

      CREATE INDEX IF NOT EXISTS idx_qa_session
        ON qa_interactions(sessionId, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_qa_record
        ON qa_interactions(recordId, timestamp DESC);
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

  getSegmentsWindow(sessionId, options = {}) {
    if (!sessionId) return [];
    const windowMs = typeof options.windowMs === 'number' ? options.windowMs : 8 * 60 * 1000;
    const cutoffMs = typeof options.cutoffMs === 'number' ? options.cutoffMs : Date.now();
    const limit = typeof options.limit === 'number' ? options.limit : 400;
    const includePrereq = typeof options.includePrereq === 'number' ? options.includePrereq : 2;

    const coalesceField = 'COALESCE(startMs, timestamp)';
    const lowerBound = cutoffMs - Math.max(windowMs, 60_000); // enforce 1 min floor

    const baseQuery = `
      SELECT *, ${coalesceField} as segmentTime
      FROM segments
      WHERE sessionId = ?
        AND ${coalesceField} <= ?
        AND ${coalesceField} >= ?
      ORDER BY segmentTime ASC
      LIMIT ?
    `;
    const rows = this.db.prepare(baseQuery).all(sessionId, cutoffMs, lowerBound, limit);

    if (!rows.length && includePrereq <= 0) {
      return rows.map((row) => this.mapSegment(row));
    }

    if (rows.length === 0 && includePrereq > 0) {
      const prereqQuery = `
        SELECT *, ${coalesceField} as segmentTime
        FROM segments
        WHERE sessionId = ?
          AND ${coalesceField} <= ?
        ORDER BY segmentTime DESC
        LIMIT ?
      `;
      const prereqRows = this.db.prepare(prereqQuery).all(sessionId, cutoffMs, includePrereq);
      return prereqRows.reverse().map((row) => this.mapSegment(row));
    }

    if (rows.length && includePrereq > 0) {
      const earliest = rows[0].segmentTime;
      const prereqQuery = `
        SELECT *, ${coalesceField} as segmentTime
        FROM segments
        WHERE sessionId = ?
          AND ${coalesceField} < ?
        ORDER BY segmentTime DESC
        LIMIT ?
      `;
      const prereqRows = this.db.prepare(prereqQuery).all(sessionId, earliest, includePrereq);
      rows.unshift(...prereqRows.reverse());
    }

    return rows.map((row) => this.mapSegment(row));
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
      // First, delete qa_interactions that reference transcription_records in this class
      this.db.prepare(`
        DELETE FROM qa_interactions
        WHERE recordId IN (SELECT id FROM transcription_records WHERE classId = ?)
      `).run(id);

      // Delete transcription_records for this class
      this.db.prepare(`DELETE FROM transcription_records WHERE classId = ?`).run(id);

      // Delete class context segments
      this.db.prepare(`DELETE FROM class_context_segments WHERE classId = ?`).run(id);

      // Delete class context sources
      this.db.prepare(`DELETE FROM class_context_sources WHERE classId = ?`).run(id);

      // Finally delete the class itself
      this.db.prepare(`DELETE FROM classes WHERE id = ?`).run(id);
    });
    trx(classId);
    console.log('[TranscriptStorage] Deleted class and all related data:', classId);
  }

  archiveClass(classId, archived = true) {
    const existing = this.db.prepare(`SELECT metadata FROM classes WHERE id = ?`).get(classId);
    if (!existing) throw new Error('Class not found');

    const metadata =
      existing.metadata && typeof existing.metadata === 'string'
        ? JSON.parse(existing.metadata)
        : {};
    metadata.archived = archived ? 1 : 0;

    this.db
      .prepare(`UPDATE classes SET metadata = ?, updatedAt = ? WHERE id = ?`)
      .run(JSON.stringify(metadata), Date.now(), classId);

    return this.getClass(classId);
  }

  // ----- Transcription record management -----
  upsertTranscriptionRecord(record) {
    // Auto-populate content from segments if missing but sessionId exists
    let content = record.content || record.fullText || null;
    if (!content && record.sessionId) {
      try {
        const segments = this.getSegmentsBySession(record.sessionId);
        if (segments && segments.length > 0) {
          content = segments.map(s => s.text).join(' ');
        }
      } catch (error) {
        console.warn('[TranscriptStorage] Failed to auto-populate content from segments:', error);
      }
    }

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
      content: content,
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
    const trx = this.db.transaction((recordId) => {
      // First delete qa_interactions that reference this transcription
      this.db.prepare(`DELETE FROM qa_interactions WHERE recordId = ?`).run(recordId);
      // Then delete the transcription record itself
      this.db.prepare(`DELETE FROM transcription_records WHERE id = ?`).run(recordId);
    });
    trx(id);
    console.log('[TranscriptStorage] Deleted transcription record and related QA interactions:', id);
  }

  // Backfill content for existing records that have sessionId but no content
  backfillTranscriptionContent() {
    // First, try to link records without sessionId to sessions
    this.linkOrphanedRecords();

    // Then backfill content
    const records = this.db.prepare(
      `SELECT id, sessionId FROM transcription_records
       WHERE sessionId IS NOT NULL AND (content IS NULL OR content = '')`
    ).all();

    let updated = 0;
    for (const row of records) {
      try {
        const segments = this.getSegmentsBySession(row.sessionId);
        if (segments && segments.length > 0) {
          const content = segments.map(s => s.text).join(' ');
          this.db.prepare(
            `UPDATE transcription_records SET content = ? WHERE id = ?`
          ).run(content, row.id);
          updated++;
        }
      } catch (error) {
        console.warn(`[TranscriptStorage] Failed to backfill content for record ${row.id}:`, error);
      }
    }

    console.log(`[TranscriptStorage] Backfilled content for ${updated} transcription records`);
    return updated;
  }

  // Link records without sessionId to appropriate sessions based on timing
  linkOrphanedRecords() {
    const orphanedRecords = this.db.prepare(
      `SELECT id, createdAt, title FROM transcription_records
       WHERE sessionId IS NULL OR sessionId = ''`
    ).all();

    let linked = 0;
    for (const record of orphanedRecords) {
      try {
        // Find a session around the same time (within 10 minutes)
        const recordTime = typeof record.createdAt === 'number' ? record.createdAt : new Date(record.createdAt).getTime();
        const sessions = this.db.prepare(
          `SELECT id, startTime FROM sessions
           WHERE startTime BETWEEN ? AND ?
           ORDER BY startTime DESC LIMIT 1`
        ).all(recordTime - 600000, recordTime + 600000); // 10 minutes before/after

        if (sessions.length > 0) {
          const session = sessions[0];
          this.db.prepare(
            `UPDATE transcription_records SET sessionId = ? WHERE id = ?`
          ).run(session.id, record.id);
          console.log(`[TranscriptStorage] Linked record ${record.id} to session ${session.id}`);
          linked++;
        }
      } catch (error) {
        console.warn(`[TranscriptStorage] Failed to link record ${record.id}:`, error);
      }
    }

    console.log(`[TranscriptStorage] Linked ${linked} orphaned records to sessions`);
    return linked;
  }

  // ----- Helpers -----
  mapClass(row) {
    const metadata =
      row.metadata && typeof row.metadata === 'string' ? JSON.parse(row.metadata) : undefined;
    return {
      id: row.id,
      code: row.code || undefined,
      name: row.name,
      colour: row.colour || undefined,
      semester: row.semester || undefined,
      metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      archived: metadata?.archived ? Boolean(metadata.archived) : false,
    };
  }

  mapTranscriptionRecord(row) {
    return {
      id: row.id,
      sessionId: row.sessionId || undefined,
      classId: row.classId || undefined,
      title: row.title,
      createdAt: typeof row.createdAt === 'number' ? new Date(row.createdAt).toISOString() : row.createdAt,
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

  mapSegment(row) {
    if (!row) return null;
    const startMs = typeof row.startMs === 'number' ? row.startMs : null;
    const endMs = typeof row.endMs === 'number' ? row.endMs : null;
    const ts = typeof row.timestamp === 'number' ? row.timestamp : null;
    return {
      id: row.id,
      sessionId: row.sessionId,
      text: row.text,
      startMs,
      endMs,
      timestamp: ts,
      confidence: row.confidence ?? null,
      absoluteMs:
        typeof row.segmentTime === 'number'
          ? row.segmentTime
          : startMs ?? ts,
    };
  }

  // ----- Q&A Interactions -----
  saveQAInteraction(interaction) {
    const payload = {
      id: interaction.id || `qa_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sessionId: interaction.sessionId,
      recordId: interaction.recordId || null,
      timestamp: interaction.timestamp || Date.now(),
      question: interaction.question,
      answer: interaction.answer,
      context: interaction.context || null,
      markerMs: interaction.markerMs || null,
      metadata: interaction.metadata ? JSON.stringify(interaction.metadata) : null,
    };

    this.db
      .prepare(
        `INSERT INTO qa_interactions
         (id, sessionId, recordId, timestamp, question, answer, context, markerMs, metadata)
         VALUES (@id, @sessionId, @recordId, @timestamp, @question, @answer, @context, @markerMs, @metadata)`
      )
      .run(payload);

    return payload;
  }

  getQAInteractionsBySession(sessionId) {
    const rows = this.db
      .prepare(`SELECT * FROM qa_interactions WHERE sessionId = ? ORDER BY timestamp ASC`)
      .all(sessionId);
    return rows.map((row) => this.mapQAInteraction(row));
  }

  getQAInteractionsByRecord(recordId) {
    const rows = this.db
      .prepare(`SELECT * FROM qa_interactions WHERE recordId = ? ORDER BY timestamp ASC`)
      .all(recordId);
    return rows.map((row) => this.mapQAInteraction(row));
  }

  mapQAInteraction(row) {
    return {
      id: row.id,
      sessionId: row.sessionId,
      recordId: row.recordId || undefined,
      timestamp: row.timestamp,
      question: row.question,
      answer: row.answer,
      context: row.context || undefined,
      markerMs: row.markerMs || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
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
