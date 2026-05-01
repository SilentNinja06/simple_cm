# 📇 Contact Dashboard


---

## 🔴 Overdue — Reach Out Now

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + name + "]]") AS "Contact",
  email AS "Email",
  priority AS "Priority",
  last_contacted AS "Last Contacted",
  next_followup AS "Was Due",
  (date(today) - last_contacted).days + " days ago" AS "Last Contact Age"
FROM "Contacts"
WHERE next_followup < date(today) AND is_template !=true
SORT priority DESC, next_followup ASC
```

---

## 🟡 Due Today

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + name + "]]") AS "Contact",
  email AS "Email",
  priority AS "Priority",
  last_contacted AS "Last Contacted"
FROM "Contacts"
WHERE next_followup = date(today) AND is_template !=true
SORT priority DESC
```

---

## 🟢 Upcoming — Next 7 Days

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + name + "]]") AS "Contact",
  email AS "Email",
  priority AS "Priority",
  next_followup AS "Follow-up Date",
  (next_followup - date(today)).days + " days" AS "In"
FROM "Contacts"
WHERE next_followup > date(today) AND next_followup <= date(today) + dur(7 days) AND is_template !=true
SORT next_followup ASC
```

---

## 📅 Upcoming — Next 30 Days

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + name + "]]") AS "Contact",
  email AS "Email",
  priority AS "Priority",
  next_followup AS "Follow-up Date",
  (next_followup - date(today)).days + " days" AS "In"
FROM "Contacts"
WHERE next_followup > date(today) + dur(7 days) AND next_followup <= date(today) + dur(30 days) AND is_template !=true
SORT next_followup ASC
```

---

## 🗂️ All Contacts

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + name + "]]") AS "Name",
  email AS "Email",
  company AS "Company",
  priority AS "Priority",
  relationship AS "Type",
  last_contacted AS "Last Contacted",
  next_followup AS "Next Follow-up",
  followup_days AS "Cadence (days)"
FROM "Contacts"
WHERE is_template !=true
SORT priority DESC, name ASC
```

---

## 📊 Stats

```dataview
TABLE WITHOUT ID
  length(rows) AS "Count"
FROM "Contacts"
GROUP BY priority AS "Priority"
```
