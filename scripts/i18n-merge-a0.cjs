/* Merge A0 — injecte les nouvelles clés i18n (externalisation hardcode) dans fr/en/es.json.
 * Deep-merge non destructif (préserve l'existant). Pluriels en inline-ICU (style missingComment).
 * Usage: node scripts/i18n-merge-a0.cjs
 */
const fs = require("fs");
const path = require("path");

// Clés plates "ns.sub.key" -> { fr, en, es }
const KEYS = {
  // ───────── dashboard.* (agent A) ─────────
  "dashboard.statusSubmittedForReview": { fr: "Soumis pour revue", en: "Submitted for review", es: "Enviado para revisión" },
  "dashboard.statusMeetingInProgress": { fr: "Réunion en cours", en: "Meeting in progress", es: "Reunión en curso" },
  "dashboard.statusAiSummaryReady": { fr: "Synthèse IA prête à valider", en: "AI summary ready to validate", es: "Resumen IA listo para validar" },
  "dashboard.statusValidatedAndShared": { fr: "Validé et diffusé", en: "Validated and shared", es: "Validado y difundido" },
  "dashboard.ctaStartMeeting": { fr: "Lancer la réunion", en: "Start the meeting", es: "Iniciar la reunión" },
  "dashboard.ctaContinuePreparation": { fr: "Continuer la préparation", en: "Continue preparation", es: "Continuar la preparación" },
  "dashboard.ctaJoinMeeting": { fr: "Rejoindre la réunion →", en: "Join the meeting →", es: "Unirse a la reunión →" },
  "dashboard.ctaViewReport": { fr: "Voir le compte-rendu", en: "View the report", es: "Ver el acta" },
  "dashboard.ctaViewValidatedReport": { fr: "Voir le rapport validé", en: "View the validated report", es: "Ver el informe validado" },
  "dashboard.overdueActions": { fr: "{{count}} action{{count, plural, one{} other{s}}} en retard", en: "{{count}} overdue action{{count, plural, one{} other{s}}}", es: "{{count}} acci{{count, plural, one{ón} other{ones}}} atrasada{{count, plural, one{} other{s}}}" },
  "dashboard.daysOverdueShort": { fr: "+{{count}}j", en: "+{{count}}d", es: "+{{count}}d" },
  "dashboard.viewAllOverdue": { fr: "Voir tous les retards →", en: "View all overdue items →", es: "Ver todos los atrasos →" },
  "dashboard.weeklyBadge": { fr: "🟢 Weekly", en: "🟢 Weekly", es: "🟢 Weekly" },
  "dashboard.monthlyBadge": { fr: "🔵 Monthly", en: "🔵 Monthly", es: "🔵 Monthly" },
  "dashboard.progress": { fr: "Progression", en: "Progress", es: "Progreso" },
  "dashboard.sectionsCount": { fr: "{{completed}}/{{total}} sections", en: "{{completed}}/{{total}} sections", es: "{{completed}}/{{total}} secciones" },
  "dashboard.viewFullReport": { fr: "Voir le rapport complet", en: "View the full report", es: "Ver el informe completo" },
  "dashboard.noCurrentReport": { fr: "Aucun rapport en cours", en: "No report in progress", es: "Ningún informe en curso" },
  "dashboard.noCurrentReportHint": { fr: "Créez un rapport pour démarrer un nouveau cycle.", en: "Create a report to start a new cycle.", es: "Cree un informe para iniciar un nuevo ciclo." },
  "dashboard.createReport": { fr: "Créer un rapport", en: "Create a report", es: "Crear un informe" },
  "dashboard.meetingInTwoDays": { fr: "Votre réunion est dans 2 jours", en: "Your meeting is in 2 days", es: "Su reunión es en 2 días" },
  "dashboard.startPreparation": { fr: "Commencer la préparation →", en: "Start preparation →", es: "Comenzar la preparación →" },
  "dashboard.responsabilitiesTitle": { fr: "Responsabilités", en: "Responsibilities", es: "Responsabilidades" },
  "dashboard.globalCompletion": { fr: "complétion globale", en: "overall completion", es: "finalización global" },
  "dashboard.activeTodos": { fr: "To-do actifs", en: "Active to-dos", es: "Tareas activas" },
  "dashboard.doneOverActive": { fr: "faits / total actifs", en: "done / total active", es: "hechas / total activas" },
  "dashboard.objectivesCount": { fr: "{{count}}/3 objectifs", en: "{{count}}/3 objectives", es: "{{count}}/3 objetivos" },
  "dashboard.activeThisMonth": { fr: "actifs ce mois", en: "active this month", es: "activos este mes" },
  "dashboard.recentActivity": { fr: "Activité récente", en: "Recent activity", es: "Actividad reciente" },
  "dashboard.view": { fr: "Voir", en: "View", es: "Ver" },
  "dashboard.reportValidatedBadge": { fr: "Rapport validé ✓", en: "Report validated ✓", es: "Informe validado ✓" },
  "dashboard.ready": { fr: "Prêt", en: "Ready", es: "Listo" },
  "dashboard.toPrepare": { fr: "À préparer", en: "To prepare", es: "Por preparar" },
  "dashboard.today": { fr: "Aujourd'hui", en: "Today", es: "Hoy" },
  "dashboard.tomorrow": { fr: "Demain", en: "Tomorrow", es: "Mañana" },
  "dashboard.inXDays": { fr: "Dans {{count}} jours", en: "In {{count}} days", es: "En {{count}} días" },
  "dashboard.openMeeting": { fr: "Ouvrir la réunion", en: "Open the meeting", es: "Abrir la reunión" },
  "dashboard.createReportShort": { fr: "Créer le rapport", en: "Create the report", es: "Crear el informe" },
  "dashboard.createReportError": { fr: "Impossible de créer le rapport.", en: "Unable to create the report.", es: "No se pudo crear el informe." },
  "dashboard.previousWeekNoReportTitle": { fr: "Semaine précédente sans rapport", en: "Previous week without a report", es: "Semana anterior sin informe" },
  "dashboard.previousWeekNoReportBody": { fr: "La réunion du {{date}} n'a pas de rapport validé. Elle apparaîtra comme réunion non effectuée dans votre historique.", en: "The meeting on {{date}} has no validated report. It will appear as a missed meeting in your history.", es: "La reunión del {{date}} no tiene un informe validado. Aparecerá como reunión no realizada en su historial." },
  "dashboard.createWeeklyForPeriodQuestion": { fr: "Créer le rapport pour la semaine du {{start}} au {{end}} ?", en: "Create the report for the week of {{start}} to {{end}}?", es: "¿Crear el informe para la semana del {{start}} al {{end}}?" },
  "dashboard.createAnyway": { fr: "Créer quand même", en: "Create anyway", es: "Crear de todos modos" },
  "dashboard.createWeeklyReportTitle": { fr: "Créer le rapport Weekly", en: "Create the Weekly report", es: "Crear el informe Weekly" },
  "dashboard.createMonthlyReportTitle": { fr: "Créer le rapport Monthly", en: "Create the Monthly report", es: "Crear el informe Monthly" },
  "dashboard.reportWillCoverPeriod": { fr: "Ce rapport couvrira la période du {{start}} au {{end}}.", en: "This report will cover the period from {{start}} to {{end}}.", es: "Este informe cubrirá el período del {{start}} al {{end}}." },
  "dashboard.meetingPlannedOn": { fr: "Réunion prévue le {{date}}.", en: "Meeting scheduled for {{date}}.", es: "Reunión prevista para el {{date}}." },
  "dashboard.briefOverdueTodos": { fr: "{{count}} to-do en retard", en: "{{count}} overdue to-do{{count, plural, one{} other{s}}}", es: "{{count}} tarea{{count, plural, one{} other{s}}} atrasada{{count, plural, one{} other{s}}}" },
  "dashboard.briefRedKpi": { fr: "{{count}} KPI en alerte sur le dernier rapport validé", en: "{{count}} KPI in alert on the last validated report", es: "{{count}} KPI en alerta en el último informe validado" },
  "dashboard.briefAtRiskObjectives": { fr: "{{count}} objectif{{count, plural, one{} other{s}}} à risque", en: "{{count}} objective{{count, plural, one{} other{s}}} at risk", es: "{{count}} objetivo{{count, plural, one{} other{s}}} en riesgo" },
  "dashboard.scheduleNotConfigured": { fr: "Calendrier de réunions non configuré — les dates affichées sont des valeurs par défaut.", en: "Meeting calendar not configured — the dates shown are default values.", es: "Calendario de reuniones no configurado — las fechas mostradas son valores predeterminados." },
  "dashboard.configure": { fr: "Configurer →", en: "Configure →", es: "Configurar →" },

  // ───────── postMeeting.* (agent B) ─────────
  "postMeeting.minutesTitle": { fr: "Compte-rendu", en: "Minutes", es: "Acta" },
  "postMeeting.reopenMeeting": { fr: "Relancer la réunion", en: "Reopen meeting", es: "Reabrir la reunión" },
  "postMeeting.viewPresentation": { fr: "Voir la présentation", en: "View presentation", es: "Ver la presentación" },
  "postMeeting.generatedInMeeting": { fr: "Générée en réunion", en: "Generated in meeting", es: "Generada en la reunión" },
  "postMeeting.idsArchivedTitle": { fr: "IDS — {{count}} point{{count, plural, one{} other{s}}} traité{{count, plural, one{} other{s}}}", en: "IDS — {{count}} item{{count, plural, one{} other{s}}} handled", es: "IDS — {{count}} punto{{count, plural, one{} other{s}}} tratado{{count, plural, one{} other{s}}}" },
  "postMeeting.causeLabel": { fr: "Cause :", en: "Cause:", es: "Causa:" },
  "postMeeting.solutionLabel": { fr: "Solution :", en: "Solution:", es: "Solución:" },
  "postMeeting.noSolution": { fr: "Sans solution", en: "No solution", es: "Sin solución" },
  "postMeeting.todoCreated": { fr: "Todo créé", en: "Task created", es: "Tarea creada" },
  "postMeeting.objectiveCreated": { fr: "Objectif créé", en: "Objective created", es: "Objetivo creado" },
  "postMeeting.recordingTranscript": { fr: "Enregistrement & Transcript", en: "Recording & Transcript", es: "Grabación y transcripción" },
  "postMeeting.recordingAvailable": { fr: "Enregistrement disponible. Lancez la transcription Whisper pour archiver les échanges.", en: "Recording available. Start the Whisper transcription to archive the discussion.", es: "Grabación disponible. Inicia la transcripción Whisper para archivar los intercambios." },
  "postMeeting.transcribeRecording": { fr: "Transcrire l'enregistrement", en: "Transcribe recording", es: "Transcribir la grabación" },
  "postMeeting.transcriptionInProgress": { fr: "Transcription Whisper en cours…", en: "Whisper transcription in progress…", es: "Transcripción Whisper en curso…" },
  "postMeeting.fullTranscript": { fr: "Transcript complet (Whisper)", en: "Full transcript (Whisper)", es: "Transcripción completa (Whisper)" },
  "postMeeting.charCount": { fr: "{{count}} car.", en: "{{count}} chars", es: "{{count}} car." },
  "postMeeting.transcriptionFailed": { fr: "Transcription échouée.", en: "Transcription failed.", es: "La transcripción ha fallado." },
  "postMeeting.retry": { fr: "Réessayer", en: "Retry", es: "Reintentar" },

  // ───────── todos.* (agent B) ─────────
  "todos.sourceIa": { fr: "IA", en: "AI", es: "IA" },
  "todos.daysOverdue": { fr: "+{{count}}j de retard", en: "{{count}}d overdue", es: "{{count}} d de retraso" },
  "todos.today": { fr: "Aujourd'hui", en: "Today", es: "Hoy" },
  "todos.inDays": { fr: "Dans {{count}}j", en: "In {{count}}d", es: "En {{count}} d" },
  "todos.toastDone": { fr: "Action terminée ✓", en: "Action completed ✓", es: "Acción completada ✓" },
  "todos.toastDeferred": { fr: "Action reportée", en: "Action postponed", es: "Acción aplazada" },
  "todos.dateRequired": { fr: "Date requise", en: "Date required", es: "Fecha obligatoria" },
  "todos.dateRequiredDesc": { fr: "Choisissez une nouvelle échéance.", en: "Choose a new due date.", es: "Elige una nueva fecha límite." },
  "todos.statusDone": { fr: "Terminé", en: "Done", es: "Completado" },
  "todos.statusInProgress": { fr: "En cours", en: "In progress", es: "En curso" },
  "todos.statusDeferred": { fr: "Reporté", en: "Postponed", es: "Aplazado" },
  "todos.deferredCount": { fr: "{{count}}×", en: "{{count}}×", es: "{{count}}×" },
  "todos.actionDone": { fr: "Fait", en: "Done", es: "Hecho" },
  "todos.actionInProgress": { fr: "En cours", en: "In progress", es: "En curso" },
  "todos.actionDefer": { fr: "Reporter", en: "Postpone", es: "Aplazar" },
  "todos.deferToLabel": { fr: "Reporter au *", en: "Postpone to *", es: "Aplazar al *" },
  "todos.reasonLabel": { fr: "Raison", en: "Reason", es: "Motivo" },
  "todos.optional": { fr: "(optionnel)", en: "(optional)", es: "(opcional)" },
  "todos.reasonPlaceholder": { fr: "Pourquoi ce report…", en: "Why this postponement…", es: "Por qué este aplazamiento…" },
  "todos.confirmDefer": { fr: "Confirmer le report", en: "Confirm postponement", es: "Confirmar el aplazamiento" },
  "todos.tabOpen": { fr: "À traiter", en: "To do", es: "Pendientes" },
  "todos.tabDone": { fr: "Terminées", en: "Completed", es: "Completadas" },
  "todos.tabAll": { fr: "Toutes", en: "All", es: "Todas" },
  "todos.pageTitle": { fr: "Actions", en: "Actions", es: "Acciones" },
  "todos.countToProcess": { fr: "{{count}} à traiter", en: "{{count}} to do", es: "{{count}} pendientes" },
  "todos.countOverdue": { fr: "{{count}} en retard", en: "{{count}} overdue", es: "{{count}} con retraso" },
  "todos.countDeferred": { fr: "{{count}} reportée{{count, plural, one{} other{s}}}", en: "{{count}} postponed", es: "{{count}} aplazada{{count, plural, one{} other{s}}}" },
  "todos.emptyOpen": { fr: "Aucune action à traiter", en: "No actions to do", es: "Ninguna acción pendiente" },
  "todos.emptyDone": { fr: "Aucune action terminée", en: "No completed actions", es: "Ninguna acción completada" },
  "todos.emptyAll": { fr: "Aucune action", en: "No actions", es: "Ninguna acción" },

  // ───────── objectifs.* (agent B) ─────────
  "objectifs.statusOnTrack": { fr: "En bonne voie", en: "On track", es: "En buen camino" },
  "objectifs.statusAtRisk": { fr: "À risque", en: "At risk", es: "En riesgo" },
  "objectifs.statusBehind": { fr: "En retard", en: "Behind", es: "Con retraso" },
  "objectifs.dueDate": { fr: "Échéance : {{date}}", en: "Due: {{date}}", es: "Fecha límite: {{date}}" },
  "objectifs.createdDuring": { fr: "Créé lors de {{label}}", en: "Created during {{label}}", es: "Creado durante {{label}}" },
  "objectifs.activeCount": { fr: "{{count}}/3 actifs", en: "{{count}}/3 active", es: "{{count}}/3 activos" },
  "objectifs.createdInfo": { fr: "Les objectifs sont créés uniquement lors des post-réunions mensuelles.", en: "Objectives are created only during monthly post-meetings.", es: "Los objetivos se crean únicamente durante las posreuniones mensuales." },
  "objectifs.emptyState": { fr: "Aucun objectif actif — ils seront créés lors de votre prochaine réunion mensuelle", en: "No active objectives — they will be created during your next monthly meeting", es: "Ningún objetivo activo — se crearán durante tu próxima reunión mensual" },
  "objectifs.limitReached": { fr: "Limite atteinte — créer uniquement via post-réunion", en: "Limit reached — create only via post-meeting", es: "Límite alcanzado — crear solo mediante posreunión" },

  // ───────── login.* (agent C) ─────────
  "login.subtitle": { fr: "Connectez-vous à votre espace", en: "Sign in to your workspace", es: "Inicia sesión en tu espacio" },
  "login.email": { fr: "Email", en: "Email", es: "Correo electrónico" },
  "login.password": { fr: "Mot de passe", en: "Password", es: "Contraseña" },
  "login.submit": { fr: "Se connecter", en: "Sign in", es: "Iniciar sesión" },
  "login.submitting": { fr: "Connexion...", en: "Signing in...", es: "Conectando..." },
  "login.invalidCredentials": { fr: "Identifiants incorrects", en: "Invalid credentials", es: "Credenciales incorrectas" },
  "login.inviteOnly": { fr: "Accès sur invitation uniquement", en: "Access by invitation only", es: "Acceso solo por invitación" },

  // ───────── voiceRecord.* (agent C) ─────────
  "voiceRecord.dictate": { fr: "Dicter", en: "Dictate", es: "Dictar" },
  "voiceRecord.notSupported": { fr: "Non supporté sur ce navigateur", en: "Not supported on this browser", es: "No compatible con este navegador" },
  "voiceRecord.micError": { fr: "Microphone non accessible", en: "Microphone not accessible", es: "Micrófono no accesible" },
  "voiceRecord.dialogTitle": { fr: "Dictée vocale", en: "Voice dictation", es: "Dictado por voz" },
  "voiceRecord.statusListening": { fr: "En écoute…", en: "Listening…", es: "Escuchando…" },
  "voiceRecord.statusPaused": { fr: "En pause", en: "Paused", es: "En pausa" },
  "voiceRecord.statusProcessing": { fr: "Structuration en cours…", en: "Structuring…", es: "Estructurando…" },
  "voiceRecord.statusIdle": { fr: "Appuyez sur le micro pour commencer", en: "Tap the mic to start", es: "Pulsa el micrófono para empezar" },
  "voiceRecord.start": { fr: "Commencer", en: "Start", es: "Empezar" },
  "voiceRecord.pause": { fr: "Pause", en: "Pause", es: "Pausar" },
  "voiceRecord.resume": { fr: "Reprendre", en: "Resume", es: "Reanudar" },
  "voiceRecord.finishAndStructure": { fr: "Fin et structurer", en: "Finish and structure", es: "Finalizar y estructurar" },

  // ───────── kpiCard.* (agent C) ─────────
  "kpiCard.status.excellent": { fr: "Excellent", en: "Excellent", es: "Excelente" },
  "kpiCard.status.green": { fr: "Bien", en: "Good", es: "Bien" },
  "kpiCard.status.amber": { fr: "Correct", en: "Fair", es: "Aceptable" },
  "kpiCard.status.red": { fr: "Insuffisant", en: "Poor", es: "Insuficiente" },
  "kpiCard.successFactorsPlaceholder": { fr: "Partager les facteurs de succès", en: "Share the success factors", es: "Comparte los factores de éxito" },
  "kpiCard.categorySpa": { fr: "Spa", en: "Spa", es: "Spa" },
  "kpiCard.categoryManager": { fr: "Manager", en: "Manager", es: "Manager" },
  "kpiCard.weeklyTarget": { fr: "Objectif semaine", en: "Weekly target", es: "Objetivo semanal" },
  "kpiCard.previousWeek": { fr: "Semaine précédente", en: "Previous week", es: "Semana anterior" },
  "kpiCard.commentRequired": { fr: "Commentaire requis", en: "Comment required", es: "Comentario obligatorio" },
  "kpiCard.weeklyCommentPlaceholder.amber": { fr: "Objectif partiellement atteint — expliquer", en: "Target partially met — explain", es: "Objetivo parcialmente alcanzado — explica" },
  "kpiCard.weeklyCommentPlaceholder.red": { fr: "Que s'est-il passé cette semaine ?", en: "What happened this week?", es: "¿Qué pasó esta semana?" },

  // ───────── rapportDetail.* (agent C) ─────────
  "rapportDetail.loading": { fr: "Chargement du rapport…", en: "Loading report…", es: "Cargando el informe…" },
  "rapportDetail.notFound": { fr: "Rapport introuvable", en: "Report not found", es: "Informe no encontrado" },
  "rapportDetail.notFoundDesc": { fr: "Ce rapport n'existe pas ou vous n'y avez pas accès.", en: "This report does not exist or you do not have access to it.", es: "Este informe no existe o no tienes acceso a él." },
  "rapportDetail.startMeeting": { fr: "Lancer la réunion", en: "Start the meeting", es: "Iniciar la reunión" },
  "rapportDetail.finalizeReport": { fr: "Finaliser le rapport", en: "Finalize the report", es: "Finalizar el informe" },
  "rapportDetail.completeMinimum": { fr: "Complétez KPI et Check-in minimum", en: "Complete at least KPI and Check-in", es: "Completa como mínimo KPI y Check-in" },
  "rapportDetail.reportFinalized": { fr: "Rapport finalisé", en: "Report finalized", es: "Informe finalizado" },
  "rapportDetail.validatedReadOnly": { fr: "Rapport validé — lecture seule", en: "Report validated — read-only", es: "Informe validado — solo lectura" },
  "rapportDetail.saving": { fr: "Enregistrement…", en: "Saving…", es: "Guardando…" },
  "rapportDetail.saved": { fr: "Sauvegardé", en: "Saved", es: "Guardado" },

  // ───────── spaHistory.* (agent C) ─────────
  "spaHistory.title": { fr: "Historique — {{name}}", en: "History — {{name}}", es: "Historial — {{name}}" },
  "spaHistory.unavailable": { fr: "Historique indisponible", en: "History unavailable", es: "Historial no disponible" },
  "spaHistory.needTwoReports": { fr: "Moins de 2 rapports validés — l'historique sera disponible dès le 2e rapport validé.", en: "Fewer than 2 validated reports — history will be available from the 2nd validated report.", es: "Menos de 2 informes validados — el historial estará disponible a partir del 2.º informe validado." },
  "spaHistory.months": { fr: "{{count}} mois", en: "{{count}} months", es: "{{count}} meses" },
  "spaHistory.filterAll": { fr: "Tous", en: "All", es: "Todos" },
  "spaHistory.timelineTitle": { fr: "Timeline des rapports", en: "Reports timeline", es: "Cronología de informes" },
  "spaHistory.kpiEvolutionTitle": { fr: "Évolution métriques clés", en: "Key metrics trend", es: "Evolución de métricas clave" },
  "spaHistory.humanSignalsTitle": { fr: "Évolution signaux humains", en: "Human signals trend", es: "Evolución de señales humanas" },
  "spaHistory.target": { fr: "Cible", en: "Target", es: "Objetivo" },
  "spaHistory.value": { fr: "Valeur", en: "Value", es: "Valor" },
  "spaHistory.teamMood": { fr: "Météo équipe", en: "Team mood", es: "Clima del equipo" },
  "spaHistory.managerEnergy": { fr: "Énergie manager", en: "Manager energy", es: "Energía del manager" },
  "spaHistory.kpisTitle": { fr: "KPIs", en: "KPIs", es: "KPIs" },
  "spaHistory.tooltipMeteoResp": { fr: "Météo : {{meteo}}/10 · Resp : {{resp}}%", en: "Mood: {{meteo}}/10 · Resp: {{resp}}%", es: "Clima: {{meteo}}/10 · Resp: {{resp}}%" },
  "spaHistory.showTable": { fr: "Afficher le tableau synthèse", en: "Show summary table", es: "Mostrar tabla resumen" },
  "spaHistory.hideTable": { fr: "Masquer le tableau synthèse", en: "Hide summary table", es: "Ocultar tabla resumen" },
  "spaHistory.metric": { fr: "Métrique", en: "Metric", es: "Métrica" },
  "spaHistory.respPercent": { fr: "Resp. %", en: "Resp. %", es: "Resp. %" },
  "spaHistory.csvPeriod": { fr: "Période", en: "Period", es: "Período" },
  "spaHistory.csvType": { fr: "Type", en: "Type", es: "Tipo" },
  "spaHistory.csvResp": { fr: "Resp %", en: "Resp %", es: "Resp %" },

  // ───────── report.* (agent C — merge dans namespaces existants) ─────────
  "report.kpi.kpiCount": { fr: "{{count}} KPI{{count, plural, one{} other{s}}}", en: "{{count}} KPI{{count, plural, one{} other{s}}}", es: "{{count}} KPI{{count, plural, one{} other{s}}}" },
  "report.todo.weekly.actionCount": { fr: "{{count}} action{{count, plural, one{} other{s}}}", en: "{{count}} action{{count, plural, one{} other{s}}}", es: "{{count}} acción{{count, plural, one{} other{es}}}" },
};

function setNested(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const LANGS = ["fr", "en", "es"];
const report = { added: 0, overwritten: [] };

for (const lang of LANGS) {
  const file = path.join(__dirname, "..", "src", "i18n", `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [dotted, tri] of Object.entries(KEYS)) {
    // détecte écrasement (clé déjà présente avec valeur différente)
    const parts = dotted.split(".");
    let cur = json, exists = true;
    for (const p of parts) { if (cur && typeof cur === "object" && p in cur) cur = cur[p]; else { exists = false; break; } }
    if (exists && typeof cur === "string" && cur !== tri[lang] && lang === "fr") report.overwritten.push(dotted);
    setNested(json, dotted, tri[lang]);
    if (lang === "fr") report.added++;
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`${lang}.json écrit`);
}
console.log(`\nClés traitées: ${report.added}`);
if (report.overwritten.length) console.log(`⚠️ Écrasements (clé existante modifiée): ${report.overwritten.join(", ")}`);
else console.log("Aucun écrasement de clé existante.");
