export type Language = 'ar' | 'en';

export interface Translations {
  // Common & Actions
  common: {
    cancel: string;
    save: string;
    delete: string;
    close: string;
    done: string;
    copy: string;
    copied: string;
    edit: string;
    add: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    refresh: string;
    search: string;
    all: string;
    empty: string;
    seconds: string;
    frames: string;
    frame: string;
    now: string;
  };

  // TitleBar Window Controls
  titleBar: {
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
  };

  // Header & Navigation
  header: {
    brand: string;
    sessions: string;
    newSession: string;
    newSessionTooltip: string;
    sessionsTooltip: string;
    code: string;
    codeTooltip: string;
    exportVideo: string;
    exportTooltip: string;
    settingsTooltip: string;
    languageTooltip: string;
    updateAvailable: string;
    updateAvailableTooltip: string;
    agentStatus: {
      busy: string;
      busyCompact: string;
      readyGoogle: string;
      readyCustom: string;
      readyCompact: string;
      stop: string;
      stopTooltip: string;
    };
  };

  // Player & Canvas Controls
  player: {
    ratio16_9: string;
    ratio9_16: string;
    ratio1_1: string;
    fit: string;
    fitTooltip: string;
    width: string;
    widthTooltip: string;
    zoom100: string;
    freeTransform: string;
    freeTransformEnable: string;
    freeTransformDisable: string;
    snapshotToChat: string;
    snapshotTooltip: string;
    reloadTooltip: string;
    snapshotName: string;
    resolutionFormat: string;
    gizmo: {
      element: string;
      deselect: string;
      rotateTooltip: string;
      scaleTooltip: string;
      editText: string;
      resetTransform: string;
      centerH: string;
      centerV: string;
      deleteElement: string;
    };
  };

  // Timeline
  timeline: {
    splitFeedbackAudio: string;
    splitFeedbackElement: string;
    splitFeedbackHoverPrompt: string;
    deleteFeedbackAudio: string;
    deleteFeedbackElement: string;
    trackConflictError: string;
    resizeHeightTooltip: string;
    currentTimecodeTooltip: string;
    frameCounterTooltip: string;
    undoTooltip: string;
    splitTooltip: string;
    addAudioTooltip: string;
    deleteSelectedTooltip: string;
    agentWorkingBadge: string;
    agentWorkingBadgeCompact: string;
    agentWorkingTooltip: string;
    pinnedFrameBadge: string;
    unpinTooltip: string;
    goToStartTooltip: string;
    prevFrameTooltip: string;
    playTooltip: string;
    pauseTooltip: string;
    nextFrameTooltip: string;
    goToEndTooltip: string;
    loopActiveTooltip: string;
    loopInactiveTooltip: string;
    pinFrameToChat: string;
    pinFrameToChatTooltip: string;
    zoomOutTooltip: string;
    zoomInTooltip: string;
    fitCompTooltip: string;
    fitCompLabel: string;
    fitAllTooltip: string;
    fitAllLabel: string;
    fitAllCompact: string;
    fullscreenTooltip: string;
    toggleCollapseTooltip: string;
    tracks: string;
    beatsTrack: string;
    textTrack: string;
    cardTrack: string;
    audioTrack: string;
    audioClipsCount: string;
    emptyAudio: string;
    clearAllAudioTooltip: string;
    addSfxTooltip: string;
    addAudioLabel: string;
    endOfCompBoundary: string;
    endOfCompTooltip: string;
    pinnedFrameMarkerTooltip: string;
    mainSceneTrack: string;
    deletedItemPrefix: string;
    holdsToEndTooltip: string;
    dragResizeStartTooltip: string;
    dragResizeEndTooltip: string;
    shotTooltip: string;
    adjustAudioStartTooltip: string;
    adjustAudioEndTooltip: string;
    trimAudioToCompTooltip: string;
    muteAudioTooltip: string;
    unmuteAudioTooltip: string;
    deleteClipTooltip: string;
    mainSceneLabel: string;
    clipPart2: string;
    editTextAndStyle: string;
    jumpToStart: string;
    copyText: string;
    textCopied: string;
    unextendHold: string;
    extendHold: string;
    splitAtPlayhead: string;
    splitOutOfRange: string;
    restoreText: string;
    hideText: string;
  };

  // Chat & AI Assistant
  chat: {
    assistantTitle: string;
    newSession: string;
    newSessionTooltip: string;
    userSender: string;
    agentSender: string;
    processing: string;
    defaultActionTitle: string;
    remotionProcessingSubtext: string;
    stepLabel: string;
    thinkingLabel: string;
    statusActive: string;
    statusCompleted: string;
    productionStagesTitle: string;
    stage1: string;
    stage2: string;
    stage3: string;
    stage4: string;
    inputPlaceholder: string;
    inputPlaceholderPinned: string;
    sendTooltip: string;
    stopTooltip: string;
    dictateStartTooltip: string;
    dictateStopTooltip: string;
    dictateUnsupported: string;
    micError: string;
    attachMenuTooltip: string;
    attachImage: string;
    attachVideo: string;
    recordVoiceover: string;
    uploadAudio: string;
    modelTooltip: string;
    modelGeneratedBy: string;
    voiceoverBadge: string;
    commandBadge: string;
    voiceoverModeDesc: string;
    commandModeDesc: string;
    switchModeToVoiceover: string;
    switchModeToCommand: string;
    transcriptLabel: string;
    keyframesExtracted: string;
    keyframeTooltip: string;
    welcomeMessage: string;
    defaultUserAudioPromptVoiceover: string;
    defaultUserAudioPromptCommand: string;
    defaultUserImagePrompt: string;
    defaultUserVideoPrompt: string;
    clickToEnlarge: string;
    imageAttached: string;
    sceneSnapshot: string;
    removeImage: string;
    playAudioPreview: string;
    stopAudioPreview: string;
    removeRecording: string;
    recordingVoiceoverNotice: string;
    recordingCommandNotice: string;
    recordVoiceoverDesc: string;
    recordCommandDesc: string;
    finishAndSaveRecording: string;
    cancelRecording: string;
    switchRecordingModeTooltip: string;
    extractingKeyframesNotice: string;
    previewReferenceVideo: string;
    referenceVideoDescription: string;
    previewButton: string;
    removeVideo: string;
    closePreview: string;
    enlargedPreview: string;
    pinnedInTimeline: string;
    unpinThisFrame: string;
    inputPromptVideoPlaceholder: string;
    inputPromptAudioPlaceholder: string;
    inputPromptImagePlaceholder: string;
    speakWithAssistantTooltip: string;
    stopRecordingTooltip: string;
    diffSummaryTitle: string;
    executionSuccessDuration: string;
    thinkingTokens: string;
    analyzingAndChecking: string;
    stoppedByUser: string;
    newSessionAction: string;
    switchSessionAction: string;
    videoSceneSuccess: string;
    noSceneChanges: string;
    agentError: string;
    defaultSessionTitle: string;
  };

  // Modals
  modals: {
    code: {
      title: string;
      subtitle: string;
      copyButton: string;
      copiedButton: string;
      closeButton: string;
    };
    export: {
      title: string;
      subtitle: string;
      fileNameLabel: string;
      formatLabel: string;
      fpsLabel: string;
      resolutionLabel: string;
      startExport: string;
      exporting: string;
      exportSuccess: string;
      exportError: string;
      openFolder: string;
    };
    sessions: {
      title: string;
      subtitle: string;
      newSession: string;
      searchPlaceholder: string;
      rename: string;
      deleteConfirm: string;
      currentBadge: string;
      lastUpdated: string;
      emptyState: string;
    };
    settings: {
      title: string;
      tabs: {
        account: string;
        agent: string;
        general: string;
        engine: string;
        about: string;
      };
      languageSection: {
        title: string;
        desc: string;
        arabicOption: string;
        englishOption: string;
      };
      autoSaveSection: {
        title: string;
        desc: string;
      };
      snappingSection: {
        title: string;
        desc: string;
      };
      accountSection: {
        title: string;
        email: string;
        signOut: string;
        guestNotice: string;
      };
      agentSection: {
        title: string;
        desc: string;
        googleMode: string;
        apiKeyMode: string;
        providerLabel: string;
        apiKeyLabel: string;
        modelLabel: string;
        testConnection: string;
        saveConfig: string;
      };
    };
    textInspector: {
      title: string;
      subtitle: string;
      textContentLabel: string;
      fontSizeLabel: string;
      colorLabel: string;
      saveButton: string;
    };
    audioLibrary: {
      title: string;
      subtitle: string;
      searchPlaceholder: string;
      addToTimeline: string;
    };
  };
}

export const translations: Record<Language, Translations> = {
  ar: {
    common: {
      cancel: 'إلغاء',
      save: 'حفظ',
      delete: 'حذف',
      close: 'إغلاق',
      done: 'تم',
      copy: 'نسخ',
      copied: 'تم النسخ',
      edit: 'تعديل',
      add: 'إضافة',
      loading: 'جارٍ التحميل...',
      error: 'حدث خطأ',
      success: 'تم بنجاح',
      warning: 'تنبيه',
      refresh: 'تحديث',
      search: 'بحث...',
      all: 'الكل',
      empty: 'فارغ',
      seconds: 'ث',
      frames: 'إطار',
      frame: 'إطار',
      now: 'الآن',
    },
    titleBar: {
      minimize: 'تصغير',
      maximize: 'تكبير',
      restore: 'استعادة',
      close: 'إغلاق',
    },
    header: {
      brand: 'after ai',
      sessions: 'الجلسات',
      newSession: 'جلسة جديدة',
      newSessionTooltip: 'بدء جلسة عمل جديدة مع قالب نظيف',
      sessionsTooltip: 'إدارة وتبديل جلسات العمل والمشاريع',
      code: 'كود المشهد',
      codeTooltip: 'عرض كود المشهد (Scene.tsx)',
      exportVideo: 'تصدير الفيديو',
      exportTooltip: 'تصدير الفيديو النهائي MP4 / ProRes',
      settingsTooltip: 'إعدادات المنصة والحساب',
      languageTooltip: 'Switch interface language to English',
      updateAvailable: 'تحديث جديد',
      updateAvailableTooltip: 'يتوفر إصدار جديد من بعد الذكاء الاصطناعي (after ai). انقر لفتح صفحة التحميل على GitHub.',
      agentStatus: {
        busy: 'الوكيل الذكي يعدل الفيديو...',
        busyCompact: 'يعدل...',
        readyGoogle: 'Google AGY متصل وجاهز',
        readyCustom: 'Agent متصل وجاهز',
        readyCompact: 'جاهز',
        stop: 'إيقاف',
        stopTooltip: 'إيقاف التوليد فوراً (Esc)',
      },
    },
    player: {
      ratio16_9: 'أفقي 16:9 (YouTube / TV)',
      ratio9_16: 'عمودي 9:16 (Reels / TikTok / Shorts)',
      ratio1_1: 'مربع 1:1 (Instagram Feed)',
      fit: 'احتواء (Fit)',
      fitTooltip: 'ملاءمة تلقائية لكامل المساحة المتاحة',
      width: 'ملء العرض',
      widthTooltip: 'توسيع المشغل لملء كامل العرض',
      zoom100: 'عرض الدقة الأصلية 100%',
      freeTransform: 'تحريك حر',
      freeTransformEnable: 'تفعيل التحريك المباشر على الشاشة',
      freeTransformDisable: 'تعطيل التحريك المباشر (وضع المعاينة النظيفة)',
      snapshotToChat: 'لقطة إطار للشات',
      snapshotTooltip: 'التقاط لقطة شاشة للإطار الحالي ووضعها في الشات (Ctrl+Shift+S)',
      reloadTooltip: 'إعادة تحميل المشغل يدوياً',
      snapshotName: 'لقطة إطار',
      resolutionFormat: 'إطار ({sec}ث) • 30 FPS',
      gizmo: {
        element: 'العنصر',
        deselect: 'إلغاء التحديد (Escape)',
        rotateTooltip: 'سحب للتدوير (اضغط Shift للتثبيت كل 15 درجة)',
        scaleTooltip: 'سحب للتكبير أو التصغير المتناسب',
        editText: 'تعديل النص مباشرة',
        resetTransform: 'إعادة ضبط التحريك (100% / 0°)',
        centerH: 'توسيط أفقي (X = 0%)',
        centerV: 'توسيط عمودي (Y = 0%)',
        deleteElement: 'حذف هذا العنصر (Delete)',
      },
    },
    timeline: {
      splitFeedbackAudio: 'تم تقسيم المقطع الصوتي عند الإطار {frame}',
      splitFeedbackElement: 'تم تقسيم العنصر بنجاح عند الإطار {frame}',
      splitFeedbackHoverPrompt: 'ضع المؤشر فوق عنصر لتقسيمه (الإطار {frame} لا يقطع أي عنصر)',
      deleteFeedbackAudio: 'تم حذف المقطع الصوتي',
      deleteFeedbackElement: 'تم حذف العنصر من التايم لاين',
      trackConflictError: 'تعذر النقل: يوجد تداخل مع عنصر آخر في المسار {track}',
      resizeHeightTooltip: 'اسحب لتكبير أو تصغير ارتفاع مسارات التايم لاين (انقر مرتين للملاءمة التلقائية)',
      currentTimecodeTooltip: 'الوقت الحالي / المدة الإجمالية ({timecode})',
      frameCounterTooltip: 'الإطار الحالي ({frame}) من إجمالي ({total})',
      undoTooltip: 'تراجع عن آخر تعديل للنصوص والمشهد (Ctrl+Z)',
      splitTooltip: 'قص وتقسيم العنصر عند المؤشر (Ctrl+B أو S)',
      addAudioTooltip: 'إضافة ملف أو مقطع صوتي للمشروع',
      deleteSelectedTooltip: 'حذف العنصر أو المقطع المحدد من التايم لاين (Delete)',
      agentWorkingBadge: 'الوكيل يعمل (تأمين)',
      agentWorkingBadgeCompact: 'الوكيل يعمل',
      agentWorkingTooltip: 'الوكيل الذكي يعمل حالياً على تعديل المشهد (تم تأمين التحرير مؤقتاً)',
      pinnedFrameBadge: 'إطار مثبت: {frame}',
      unpinTooltip: 'إلغاء التثبيت',
      goToStartTooltip: 'الانتقال للبداية (Home)',
      prevFrameTooltip: 'إطار للخلف (Left Arrow)',
      playTooltip: 'تشغيل (Space)',
      pauseTooltip: 'إيقاف مؤقت (Space)',
      nextFrameTooltip: 'إطار للأمام (Right Arrow)',
      goToEndTooltip: 'الانتقال للنهاية (End)',
      loopActiveTooltip: 'التكرار مفعل',
      loopInactiveTooltip: 'التكرار متوقف',
      pinFrameToChat: 'تحديد الإطار للشات',
      pinFrameToChatTooltip: 'تحديد هذا الإطار الدقيق وإرساله للشات للمساعد الذكي',
      zoomOutTooltip: 'تصغير التايم لاين',
      zoomInTooltip: 'تكبير التايم لاين',
      fitCompTooltip: 'ملاءمة المشهد (Fit Comp - 100%)',
      fitCompLabel: 'المشهد',
      fitAllTooltip: 'ملاءمة كامل المحتوى لرؤية نهاية الصوت',
      fitAllLabel: 'كامل المحتوى',
      fitAllCompact: 'الكل',
      fullscreenTooltip: 'ملء الشاشة للمشغل',
      toggleCollapseTooltip: 'طي أو إظهار مسارات التايم لاين',
      tracks: 'المسارات',
      beatsTrack: 'الإيقاع (Beats)',
      textTrack: 'مسار نص {idx}',
      cardTrack: 'مسار عنصر {idx}',
      audioTrack: 'المسار الصوتي',
      audioClipsCount: '{count} مقاطع',
      emptyAudio: 'فارغ',
      clearAllAudioTooltip: 'حذف جميع المقاطع الصوتية من التايم لاين والمشهد',
      addSfxTooltip: 'إضافة مؤثر صوتي أو موسيقى عند الإطار الحالي',
      addAudioLabel: 'صوت',
      endOfCompBoundary: 'نهاية المشهد ({frames}F)',
      endOfCompTooltip: 'نهاية نطاق المشهد: {frames} إطار',
      pinnedFrameMarkerTooltip: 'إطار مثبت للشات: {frame}',
      mainSceneTrack: 'المشهد الرئيسي (Scene)',
      deletedItemPrefix: '[محذوف]',
      holdsToEndTooltip: 'مستمر حتى نهاية المشهد',
      dragResizeStartTooltip: 'سحب لتقليص أو تمديد البداية',
      dragResizeEndTooltip: 'سحب لتقليص أو تمديد النهاية',
      shotTooltip: 'اللقطة {num}: {name} (الإطار {start} إلى {end})',
      adjustAudioStartTooltip: 'سحب لضبط بداية الصوت',
      adjustAudioEndTooltip: 'سحب لضبط نهاية الصوت',
      trimAudioToCompTooltip: 'قص الصوت لمطابقة نهاية المشهد',
      muteAudioTooltip: 'كتم الصوت',
      unmuteAudioTooltip: 'إلغاء كتم الصوت',
      deleteClipTooltip: 'حذف المقطع الصوتي',
      mainSceneLabel: 'المشهد الرئيسي (Scene)',
      clipPart2: 'جزء 2',
      editTextAndStyle: 'تعديل النص والمظهر',
      jumpToStart: 'انتقال إلى البداية',
      copyText: 'نسخ النص',
      textCopied: 'تم نسخ النص',
      unextendHold: 'إلغاء التمديد التلقائي',
      extendHold: 'تمديد حتى نهاية الفيديو',
      splitAtPlayhead: 'تقسيم عند المؤشر الحالي',
      splitOutOfRange: 'المؤشر ({frame}) خارج نطاق هذا العنصر ({start} - {end})',
      restoreText: 'استعادة النص للمشهد',
      hideText: 'إخفاء من المشهد',
    },
    chat: {
      assistantTitle: 'المساعد البرمجي الذكي',
      newSession: 'جلسة جديدة',
      newSessionTooltip: 'بدء جلسة عمل جديدة مع قالب نظيف',
      userSender: 'المستخدم',
      agentSender: 'وكيل Remotion',
      processing: 'جارٍ المعالجة',
      defaultActionTitle: 'تحليل التوجيه الإبداعي وتنسيق المشاهد...',
      remotionProcessingSubtext: 'محرك Remotion يعالج عناصر المشهد ويحدّث كود العرض',
      stepLabel: 'الخطوة {step}',
      thinkingLabel: 'تفكير: {sec}ث',
      statusActive: 'جاري التنفيذ...',
      statusCompleted: 'مكتمل',
      productionStagesTitle: 'مراحل الإنتاج والتصميم',
      stage1: 'تحليل التوجيه الإبداعي وتنسيق المشاهد',
      stage2: 'بناء الهوية البصرية والطبقات الحركية',
      stage3: 'تدقيق المؤثرات والحركات الفيزيائية',
      stage4: 'تحديث المشهد والمعاينة الحية في الاستوديو',
      inputPlaceholder: 'اكتب التوجيه الإبداعي للفيديو أو الصق صورة أو فيديو... (Ctrl+V)',
      inputPlaceholderPinned: 'اكتب توجيهك لهذا الإطار المثبت بالتحديد...',
      sendTooltip: 'إرسال التوجيه (Enter)',
      stopTooltip: 'إيقاف المعالجة الحالية',
      dictateStartTooltip: 'بدء الإملاء الصوتي المباشر',
      dictateStopTooltip: 'إيقاف الإملاء الصوتي',
      dictateUnsupported: 'الإملاء الصوتي غير مدعوم في هذا المتصفح. يرجى استخدام Google Chrome أو Microsoft Edge.',
      micError: 'تعذر الوصول إلى الميكروفون. يرجى التأكد من توصيله وإعطاء الصلاحية.',
      attachMenuTooltip: 'إرفاق وسائط (صورة، فيديو، تسجيل صوتي)',
      attachImage: 'إرفاق صورة مرجعية',
      attachVideo: 'إرفاق فيديو مرجعي (حتى 30ث)',
      recordVoiceover: 'تسجيل تعليق صوتي للمشهد',
      uploadAudio: 'رفع ملف صوتي للمشهد',
      modelTooltip: 'تبديل نموذج الذكاء الاصطناعي النشط',
      modelGeneratedBy: 'مولد بالذكاء الاصطناعي',
      voiceoverBadge: 'تعليق للمشهد',
      commandBadge: 'محادثة وأمر',
      voiceoverModeDesc: 'تعليق صوتي للمشهد: سيتم وضعه في التايم لاين ومزامنة المشهد معه.',
      commandModeDesc: 'محادثة وتوجيه صوتي: سيستمع المساعد لطلبك ويجيبك أو ينفذه دون وضعه في الفيديو.',
      switchModeToVoiceover: 'تبديل إلى تعليق للمشهد',
      switchModeToCommand: 'تبديل إلى أمر/محادثة',
      transcriptLabel: 'النص الصوتي:',
      keyframesExtracted: 'اللقطات المفتاحية المستخرجة ({count} إطارات):',
      keyframeTooltip: 'اللقطة {idx}: الثانية {sec} (الإطار {frame})',
      welcomeMessage: 'مرحباً بك في استوديو Remotion الذكي.\n\nوكيل البرمجة متصل وجاهز لتعديل المشاهد وتطبيق الحركات الفيزيائية والانتقالات. اكتب توجيهك الإبداعي في الأسفل لتعديل كود المشهد والمعاينة فوراً.',
      defaultUserAudioPromptVoiceover: 'توليد ومزامنة المشهد مع التعليق الصوتي المرفق',
      defaultUserAudioPromptCommand: 'رسالة وأمر صوتي للمساعد الذكي',
      defaultUserImagePrompt: 'مراجعة وتطبيق التعديل بناءً على الصورة المرفقة',
      defaultUserVideoPrompt: 'توليد وتصميم مشهد موشن جرافيك مستلهم من الفيديو المرجعي المرفق',
      clickToEnlarge: 'انقر للتكبير',
      imageAttached: 'صورة مرفقة',
      sceneSnapshot: 'لقطة شاشة للمشهد',
      removeImage: 'إزالة الصورة',
      playAudioPreview: 'تشغيل ومعاينة الصوت',
      stopAudioPreview: 'إيقاف المعاينة',
      removeRecording: 'إزالة التسجيل',
      recordingVoiceoverNotice: 'جارٍ تسجيل تعليق صوتي للمشهد...',
      recordingCommandNotice: 'جارٍ التحدث مع المساعد الذكي...',
      recordVoiceoverDesc: 'تحدث بالتعليق الصوتي: سيتم دمجه في التايم لاين ومزامنة المشهد معه.',
      recordCommandDesc: 'تحدث بطلبك أو استفسارك: سيستمع المساعد ويجيبك أو ينفذ أمرك.',
      finishAndSaveRecording: 'إنهاء وحفظ التسجيل',
      cancelRecording: 'إلغاء التسجيل',
      switchRecordingModeTooltip: 'تبديل وضع التسجيل بين محادثة/أمر صوتي وتعليق للمشهد',
      extractingKeyframesNotice: 'جاري استخراج اللقطات المفتاحية من الفيديو:',
      previewReferenceVideo: 'معاينة الفيديو المرجعي',
      referenceVideoDescription: 'فيديو مرجعي ملهم: تم استخراج {count} لقطات مفتاحية للذكاء الاصطناعي لفهم التكوين والحركة.',
      previewButton: 'معاينة',
      removeVideo: 'إزالة الفيديو',
      closePreview: 'إغلاق المعاينة',
      enlargedPreview: 'معاينة مكبرة',
      pinnedInTimeline: 'محدد في التايم لاين: الإطار {frame} ({sec}ث)',
      unpinThisFrame: 'إلغاء تحديد هذا الإطار',
      inputPromptVideoPlaceholder: 'اكتب توجيهك حول الفيديو المرجعي المرفق (أو اضغط Enter مباشرة)...',
      inputPromptAudioPlaceholder: 'اكتب توجيهك حول التعليق الصوتي المرفق (أو اضغط Enter مباشرة)...',
      inputPromptImagePlaceholder: 'اكتب توجيهك حول الصورة المرفقة (أو اضغط Enter مباشرة)...',
      speakWithAssistantTooltip: 'تحدث مع المساعد الذكي (أمر صوتي أو محادثة)',
      stopRecordingTooltip: 'إيقاف التسجيل وحفظه',
      diffSummaryTitle: 'الملفات المعدلة وتدقيق الفروقات ({count})',
      executionSuccessDuration: 'اكتمل تنفيذ التوجيه بنجاح خلال {sec} ثانية',
      thinkingTokens: 'تفكير: {tokens} توكن',
      analyzingAndChecking: 'معالجة الكود والتحقق من التغييرات...',
      stoppedByUser: 'تم إيقاف التوليد بواسطة المستخدم.',
      newSessionAction: 'تهيئة جلسة جديدة وقالب نظيف...',
      switchSessionAction: 'استرجاع بيانات الجلسة ومشهد الفيديو...',
      videoSceneSuccess: 'تم تصميم وتحديث مشهد الفيديو بنجاح!',
      noSceneChanges: 'لم يتم إجراء أي تعديل على المشهد.',
      agentError: 'حدث خطأ أثناء تشغيل الوكيل البرمجي.',
      defaultSessionTitle: 'مشروع الفيديو',
    },
    modals: {
      code: {
        title: 'كود المشهد الحركي (Scene.tsx)',
        subtitle: 'المعاينة البرمجية المباشرة للمشهد النشط',
        copyButton: 'نسخ الكود',
        copiedButton: 'تم النسخ!',
        closeButton: 'إغلاق',
      },
      export: {
        title: 'تصدير الفيديو النهائي',
        subtitle: 'رندر فائق السرعة عبر محرك Remotion المدمج',
        fileNameLabel: 'اسم ملف الفيديو',
        formatLabel: 'صيغة الإخراج (Format)',
        fpsLabel: 'معدل الإطارات (FPS)',
        resolutionLabel: 'الدقة والأبعاد',
        startExport: 'بدء تصدير الفيديو',
        exporting: 'جارٍ رندر الفيديو وتصديره...',
        exportSuccess: 'تم تصدير الفيديو بنجاح!',
        exportError: 'فشل تصدير الفيديو',
        openFolder: 'فتح المجلد',
      },
      sessions: {
        title: 'جلسات العمل والمشاريع',
        subtitle: 'إدارة مشاريعك وتبديل الجلسات في الاستوديو',
        newSession: 'مشروع جديد',
        searchPlaceholder: 'البحث في المشاريع والجلسات...',
        rename: 'إعادة تسمية',
        deleteConfirm: 'حذف الجلسة',
        currentBadge: 'الجلسة النشطة',
        lastUpdated: 'آخر تعديل:',
        emptyState: 'لا توجد جلسات عمل مسجلة',
      },
      settings: {
        title: 'إعدادات المنصة',
        tabs: {
          account: 'الحساب',
          agent: 'محرك الذكاء الاصطناعي',
          general: 'بيئة العمل والتفاعل',
          engine: 'محرك الرندر',
          about: 'حول المنصة',
        },
        languageSection: {
          title: 'لغة الواجهة (Interface Language)',
          desc: 'اختر لغة عرض نصوص الواجهة والتطبيق',
          arabicOption: 'العربية (Arabic)',
          englishOption: 'English (الإنجليزية)',
        },
        autoSaveSection: {
          title: 'الحفظ التلقائي لكود المشهد',
          desc: 'حفظ التعديلات في الجلسة تلقائياً عند كل تغيير',
        },
        snappingSection: {
          title: 'المحاذاة الذكية والمغناطيسية (Transform Snapping)',
          desc: 'إظهار خطوط الإرشاد البرتقالية عند محاذاة العناصر مع مركز الشاشة والحواف',
        },
        accountSection: {
          title: 'الملف الشخصي والجلسة',
          email: 'البريد الإلكتروني',
          signOut: 'تسجيل الخروج',
          guestNotice: 'أنت مسجل حالياً كضيف محلي',
        },
        agentSection: {
          title: 'محرك الوكيل الذكي (Agent Engine)',
          desc: 'اختر بين نموذج Google AGY المتكامل أو مفتاح API مخصص',
          googleMode: 'Google AGY CLI (تلقائي ومدمج)',
          apiKeyMode: 'Custom API Key (OpenRouter / Gemini API)',
          providerLabel: 'مزود الخدمة (Provider)',
          apiKeyLabel: 'مفتاح API الخاص بك',
          modelLabel: 'معرّف النموذج (Model ID)',
          testConnection: 'اختبار الاتصال',
          saveConfig: 'حفظ وتفعيل المحرك',
        },
      },
      textInspector: {
        title: 'محرر النصوص والعناصر الحركية',
        subtitle: 'تعديل الخصائص البصرية والطباعية للعنصر المحدد',
        textContentLabel: 'محتوى النص',
        fontSizeLabel: 'حجم الخط (px)',
        colorLabel: 'لون العنصر',
        saveButton: 'تطبيق وحفظ التعديلات',
      },
      audioLibrary: {
        title: 'مكتبة المقاطع والمؤثرات الصوتية',
        subtitle: 'مؤثرات صوتية وموسيقى تصويرية جاهزة للاستخدام في المشهد',
        searchPlaceholder: 'البحث في المؤثرات والموسيقى...',
        addToTimeline: 'إدراج في التايم لاين',
      },
    },
  },
  en: {
    common: {
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      close: 'Close',
      done: 'Done',
      copy: 'Copy',
      copied: 'Copied',
      edit: 'Edit',
      add: 'Add',
      loading: 'Loading...',
      error: 'Error occurred',
      success: 'Success',
      warning: 'Warning',
      refresh: 'Refresh',
      search: 'Search...',
      all: 'All',
      empty: 'Empty',
      seconds: 's',
      frames: 'frames',
      frame: 'frame',
      now: 'Now',
    },
    titleBar: {
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      close: 'Close',
    },
    header: {
      brand: 'after ai',
      sessions: 'Sessions',
      newSession: 'New Session',
      newSessionTooltip: 'Start a new project session with clean starter',
      sessionsTooltip: 'Manage and switch project sessions',
      code: 'Scene Code',
      codeTooltip: 'View Scene Source Code (Scene.tsx)',
      exportVideo: 'Export Video',
      exportTooltip: 'Export Final Video (MP4 / ProRes)',
      settingsTooltip: 'Platform & Account Settings',
      languageTooltip: 'التبديل إلى العربية (Switch to Arabic)',
      updateAvailable: 'Update Available',
      updateAvailableTooltip: 'A new version of after ai is available on GitHub. Click to download.',
      agentStatus: {
        busy: 'AI Agent is editing video...',
        busyCompact: 'Editing...',
        readyGoogle: 'Google AGY Connected & Ready',
        readyCustom: 'Agent Connected & Ready',
        readyCompact: 'Ready',
        stop: 'Stop',
        stopTooltip: 'Stop Generation Immediately (Esc)',
      },
    },
    player: {
      ratio16_9: 'Landscape 16:9 (YouTube / TV)',
      ratio9_16: 'Vertical 9:16 (Reels / TikTok / Shorts)',
      ratio1_1: 'Square 1:1 (Instagram Feed)',
      fit: 'Fit',
      fitTooltip: 'Auto fit into entire available viewport',
      width: 'Fill Width',
      widthTooltip: 'Expand player to fill entire width',
      zoom100: 'Native 100% Zoom',
      freeTransform: 'Free Transform',
      freeTransformEnable: 'Enable On-Canvas Free Transform Gizmo',
      freeTransformDisable: 'Disable Gizmo (Clean Preview Mode)',
      snapshotToChat: 'Snapshot to Chat',
      snapshotTooltip: 'Capture current frame snapshot to chat (Ctrl+Shift+S)',
      reloadTooltip: 'Manually reload player',
      snapshotName: 'Frame Snapshot',
      resolutionFormat: 'frame ({sec}s) • 30 FPS',
      gizmo: {
        element: 'Element',
        deselect: 'Deselect (Escape)',
        rotateTooltip: 'Drag to rotate (Hold Shift to snap to 15°)',
        scaleTooltip: 'Drag for proportional scale',
        editText: 'Edit text directly',
        resetTransform: 'Reset transform (100% / 0°)',
        centerH: 'Center horizontally (X = 0%)',
        centerV: 'Center vertically (Y = 0%)',
        deleteElement: 'Delete this element (Delete)',
      },
    },
    timeline: {
      splitFeedbackAudio: 'Audio clip split at frame {frame}',
      splitFeedbackElement: 'Element split successfully at frame {frame}',
      splitFeedbackHoverPrompt: 'Place playhead over element to split (frame {frame} has no element)',
      deleteFeedbackAudio: 'Audio clip deleted',
      deleteFeedbackElement: 'Element deleted from timeline',
      trackConflictError: 'Cannot move: collision with another element on track {track}',
      resizeHeightTooltip: 'Drag to adjust timeline tracks height (double-click for auto-fit)',
      currentTimecodeTooltip: 'Current Timecode / Total Duration ({timecode})',
      frameCounterTooltip: 'Current Frame ({frame}) of ({total})',
      undoTooltip: 'Undo last text & scene change (Ctrl+Z)',
      splitTooltip: 'Split element at playhead (Ctrl+B or S)',
      addAudioTooltip: 'Add audio clip to project',
      deleteSelectedTooltip: 'Delete selected element or clip (Delete)',
      agentWorkingBadge: 'Agent Active (Locked)',
      agentWorkingBadgeCompact: 'Agent Active',
      agentWorkingTooltip: 'AI Agent is currently modifying scene (editing locked)',
      pinnedFrameBadge: 'Pinned Frame: {frame}',
      unpinTooltip: 'Unpin Frame',
      goToStartTooltip: 'Go to Start (Home)',
      prevFrameTooltip: 'Step 1 Frame Back (Left Arrow)',
      playTooltip: 'Play (Space)',
      pauseTooltip: 'Pause (Space)',
      nextFrameTooltip: 'Step 1 Frame Forward (Right Arrow)',
      goToEndTooltip: 'Go to End (End)',
      loopActiveTooltip: 'Looping Enabled',
      loopInactiveTooltip: 'Looping Disabled',
      pinFrameToChat: 'Pin Frame to Chat',
      pinFrameToChatTooltip: 'Pin this exact frame and send to AI assistant in chat',
      zoomOutTooltip: 'Zoom Out Timeline',
      zoomInTooltip: 'Zoom In Timeline',
      fitCompTooltip: 'Fit Composition (100%)',
      fitCompLabel: 'Comp',
      fitAllTooltip: 'Fit all content to see audio end',
      fitAllLabel: 'Fit All',
      fitAllCompact: 'All',
      fullscreenTooltip: 'Toggle Fullscreen Player',
      toggleCollapseTooltip: 'Collapse / Expand Timeline Tracks',
      tracks: 'Tracks',
      beatsTrack: 'Beats',
      textTrack: 'Text Track {idx}',
      cardTrack: 'Card Track {idx}',
      audioTrack: 'Audio Track',
      audioClipsCount: '{count} clips',
      emptyAudio: 'Empty',
      clearAllAudioTooltip: 'Delete all audio clips from timeline and scene',
      addSfxTooltip: 'Add sound effect or music at current frame',
      addAudioLabel: 'Audio',
      endOfCompBoundary: 'Comp End ({frames}F)',
      endOfCompTooltip: 'Scene Composition Boundary: {frames} frames',
      pinnedFrameMarkerTooltip: 'Pinned Frame for Chat: {frame}',
      mainSceneTrack: 'Main Scene',
      deletedItemPrefix: '[Deleted]',
      holdsToEndTooltip: 'Holds until end of scene',
      dragResizeStartTooltip: 'Drag to trim or extend start',
      dragResizeEndTooltip: 'Drag to trim or extend end',
      shotTooltip: 'Shot {num}: {name} (Frame {start} to {end})',
      adjustAudioStartTooltip: 'Drag to adjust audio start',
      adjustAudioEndTooltip: 'Drag to adjust audio end',
      trimAudioToCompTooltip: 'Trim audio to match scene composition end',
      muteAudioTooltip: 'Mute audio',
      unmuteAudioTooltip: 'Unmute audio',
      deleteClipTooltip: 'Delete audio clip',
      mainSceneLabel: 'Main Scene',
      clipPart2: 'Part 2',
      editTextAndStyle: 'Edit text & styling',
      jumpToStart: 'Jump to start',
      copyText: 'Copy text',
      textCopied: 'Text copied',
      unextendHold: 'Disable auto-hold',
      extendHold: 'Hold until end of video',
      splitAtPlayhead: 'Split at playhead',
      splitOutOfRange: 'Playhead ({frame}) is outside element range ({start} - {end})',
      restoreText: 'Restore text to scene',
      hideText: 'Hide from scene',
    },
    chat: {
      assistantTitle: 'Smart Code Assistant',
      newSession: 'New Session',
      newSessionTooltip: 'Start a new project session with clean starter',
      userSender: 'User',
      agentSender: 'Remotion Agent',
      processing: 'Processing',
      defaultActionTitle: 'Analyzing creative direction and scenes...',
      remotionProcessingSubtext: 'Remotion engine processing scene elements and updating code',
      stepLabel: 'Step {step}',
      thinkingLabel: 'Thinking: {sec}s',
      statusActive: 'Executing...',
      statusCompleted: 'Completed',
      productionStagesTitle: 'Production & Design Stages',
      stage1: 'Analyzing creative direction and scenes',
      stage2: 'Building visual identity and motion layers',
      stage3: 'Auditing physical transitions and effects',
      stage4: 'Updating scene and live preview in studio',
      inputPlaceholder: 'Type creative prompt for video or paste image/video... (Ctrl+V)',
      inputPlaceholderPinned: 'Type specific prompt for this pinned frame...',
      sendTooltip: 'Send prompt (Enter)',
      stopTooltip: 'Stop current processing',
      dictateStartTooltip: 'Start live voice dictation',
      dictateStopTooltip: 'Stop voice dictation',
      dictateUnsupported: 'Voice dictation is unsupported in this browser. Please use Google Chrome or Microsoft Edge.',
      micError: 'Could not access microphone. Please check connections and permissions.',
      attachMenuTooltip: 'Attach media (Image, Video, Audio)',
      attachImage: 'Attach Reference Image',
      attachVideo: 'Attach Reference Video (up to 30s)',
      recordVoiceover: 'Record Voiceover for Scene',
      uploadAudio: 'Upload Audio File for Scene',
      modelTooltip: 'Switch active AI model',
      modelGeneratedBy: 'AI Generated',
      voiceoverBadge: 'Scene Voiceover',
      commandBadge: 'Chat & Command',
      voiceoverModeDesc: 'Scene Voiceover: Placed on timeline and synchronized with motion visuals.',
      commandModeDesc: 'Voice Chat: AI Assistant listens to your instruction without placing audio in video.',
      switchModeToVoiceover: 'Switch to Scene Voiceover',
      switchModeToCommand: 'Switch to Voice Command',
      transcriptLabel: 'Spoken Transcript:',
      keyframesExtracted: 'Extracted Keyframes ({count} frames):',
      keyframeTooltip: 'Shot {idx}: {sec}s (Frame {frame})',
      welcomeMessage: 'Welcome to Remotion AI Studio.\n\nThe coding agent is connected and ready to design motion graphics, transitions, and cards. Enter your creative direction below to code and preview live.',
      defaultUserAudioPromptVoiceover: 'Generate and synchronize scene with attached voiceover',
      defaultUserAudioPromptCommand: 'Voice message and command for AI Assistant',
      defaultUserImagePrompt: 'Review and apply changes based on attached image',
      defaultUserVideoPrompt: 'Generate and design motion graphics scene inspired by reference video',
      clickToEnlarge: 'Click to enlarge',
      imageAttached: 'Attached Image',
      sceneSnapshot: 'Scene Snapshot',
      removeImage: 'Remove image',
      playAudioPreview: 'Play audio preview',
      stopAudioPreview: 'Stop preview',
      removeRecording: 'Remove recording',
      recordingVoiceoverNotice: 'Recording scene voiceover...',
      recordingCommandNotice: 'Speaking with AI assistant...',
      recordVoiceoverDesc: 'Speak your voiceover: it will be merged into the timeline and synchronized with the scene.',
      recordCommandDesc: 'Speak your instruction: the assistant will answer or execute without placing it in the video.',
      finishAndSaveRecording: 'Finish and save recording',
      cancelRecording: 'Cancel recording',
      switchRecordingModeTooltip: 'Switch recording mode between voice command and scene voiceover',
      extractingKeyframesNotice: 'Extracting keyframes from video:',
      previewReferenceVideo: 'Preview reference video',
      referenceVideoDescription: 'Reference video: extracted {count} keyframes for AI composition and motion analysis.',
      previewButton: 'Preview',
      removeVideo: 'Remove video',
      closePreview: 'Close preview',
      enlargedPreview: 'Enlarged preview',
      pinnedInTimeline: 'Pinned in timeline: Frame {frame} ({sec}s)',
      unpinThisFrame: 'Unpin this frame',
      inputPromptVideoPlaceholder: 'Type instructions for reference video (or press Enter directly)...',
      inputPromptAudioPlaceholder: 'Type instructions for attached audio (or press Enter directly)...',
      inputPromptImagePlaceholder: 'Type instructions for attached image (or press Enter directly)...',
      speakWithAssistantTooltip: 'Speak with AI assistant (voice command or chat)',
      stopRecordingTooltip: 'Stop and save recording',
      diffSummaryTitle: 'Modified files and diffs ({count})',
      executionSuccessDuration: 'Completed successfully in {sec}s',
      thinkingTokens: 'Thinking: {tokens} tokens',
      analyzingAndChecking: 'Processing code and validating changes...',
      stoppedByUser: 'Generation stopped by user.',
      newSessionAction: 'Initializing new session and clean starter...',
      switchSessionAction: 'Restoring session data and scene composition...',
      videoSceneSuccess: 'Video scene designed and updated successfully!',
      noSceneChanges: 'No modifications were made to the scene.',
      agentError: 'An error occurred while running the coding agent.',
      defaultSessionTitle: 'Video Project',
    },
    modals: {
      code: {
        title: 'Motion Scene Code (Scene.tsx)',
        subtitle: 'Live programmatic source code of active scene',
        copyButton: 'Copy Code',
        copiedButton: 'Copied!',
        closeButton: 'Close',
      },
      export: {
        title: 'Export Final Video',
        subtitle: 'Ultra-fast rendering powered by Remotion engine',
        fileNameLabel: 'Video File Name',
        formatLabel: 'Export Format',
        fpsLabel: 'Frame Rate (FPS)',
        resolutionLabel: 'Resolution & Dimensions',
        startExport: 'Start Video Export',
        exporting: 'Rendering and exporting video...',
        exportSuccess: 'Video exported successfully!',
        exportError: 'Video export failed',
        openFolder: 'Open Folder',
      },
      sessions: {
        title: 'Work Sessions & Projects',
        subtitle: 'Manage your projects and switch studio sessions',
        newSession: 'New Project',
        searchPlaceholder: 'Search projects and sessions...',
        rename: 'Rename',
        deleteConfirm: 'Delete Session',
        currentBadge: 'Active Session',
        lastUpdated: 'Last Updated:',
        emptyState: 'No saved sessions found',
      },
      settings: {
        title: 'Platform Settings',
        tabs: {
          account: 'Account',
          agent: 'AI Engine',
          general: 'Workspace & General',
          engine: 'Render Engine',
          about: 'About',
        },
        languageSection: {
          title: 'Interface Language (لغة الواجهة)',
          desc: 'Select preferred language for user interface and labels',
          arabicOption: 'العربية (Arabic)',
          englishOption: 'English (الإنجليزية)',
        },
        autoSaveSection: {
          title: 'Scene Code Auto-Save',
          desc: 'Automatically save scene edits into session on every change',
        },
        snappingSection: {
          title: 'Transform Snapping & Smart Guides',
          desc: 'Show orange guide lines when snapping elements to screen center and bounds',
        },
        accountSection: {
          title: 'User Profile & Session',
          email: 'Email',
          signOut: 'Sign Out',
          guestNotice: 'Currently signed in as local guest',
        },
        agentSection: {
          title: 'AI Agent Engine',
          desc: 'Switch between built-in Google AGY CLI or Custom API Key',
          googleMode: 'Google AGY CLI (Integrated)',
          apiKeyMode: 'Custom API Key (OpenRouter / Gemini API)',
          providerLabel: 'Provider',
          apiKeyLabel: 'Your API Key',
          modelLabel: 'Model ID',
          testConnection: 'Test Connection',
          saveConfig: 'Save & Activate Engine',
        },
      },
      textInspector: {
        title: 'Text & Element Inspector',
        subtitle: 'Modify visual and typography properties of selected element',
        textContentLabel: 'Text Content',
        fontSizeLabel: 'Font Size (px)',
        colorLabel: 'Element Color',
        saveButton: 'Apply & Save Changes',
      },
      audioLibrary: {
        title: 'SFX & Music Library',
        subtitle: 'Curated sound effects and soundtrack ready for your scene',
        searchPlaceholder: 'Search sound effects and music...',
        addToTimeline: 'Add to Timeline',
      },
    },
  },
};
