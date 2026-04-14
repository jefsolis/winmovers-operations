const router = require('express').Router()
const { sendMail } = require('../services/graph')

/**
 * POST /api/email/send
 * Body: { to, subject, html, replyTo?, replyToName? }
 *
 * Sends a transactional email via Graph API using the AZURE_MAIL_FROM mailbox.
 * Caller supplies the rendered HTML — no templating here.
 */
router.post('/send', async (req, res, next) => {
  try {
    const { to, subject, html, replyTo, replyToName } = req.body
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'to, subject and html are required' })
    }
    await sendMail({ to, subject, html, replyTo, replyToName })
    res.status(204).end()
  } catch (err) { next(err) }
})

module.exports = router
