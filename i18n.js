// i18n.js

function escapeMarkdownV2Internal(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

const languages = {

    fa: {
        // --- General ---
        greeting_admin: "سلام\\! 👋 برای شروع یکی از گزینه‌ها را انتخاب کن\\.",
        greeting_user_approved: "🎉 به پنل کاربری خود خوش آمدید\\!\n\nاز طریق دکمه زیر می‌توانید اکانت خود را مدیریت کرده و لینک زیرمجموعه‌گیری خود را دریافت کنید\\.",
        error_generic: "❌ متأسفانه خطایی رخ داد\\. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید\\.",
        errorMenu: "⚠️ نمایش منو با مشکل مواجه شد\\. لطفاً چند لحظه صبر کرده و دوباره تلاش کنید\\.",
        permission_denied: "🚫 متأسفانه شما به این بخش دسترسی ندارید\\.\n\nاگر فکر می‌کنید این اشتباه است، لطفاً با مدیریت تماس بگیرید\\.",
        errorServerNotFound: "🔍 سروری با این مشخصات یافت نشد\\.\n\nلطفاً از منوی مدیریت سرورها مجدداً تلاش کنید\\.",
        
        // --- Language Selection ---
        choose_language_prompt: "لطفا زبان خود را انتخاب کنید\nPlease choose your language",
        language_changed: "✅ زبان با موفقیت به پارسی تغییر کرد\\.",

        // --- Menus & Buttons ---
        btn_rcon_menu: "اتصال مستقیم به rcon",
        btn_admin_panel: "⚙️ بخش مدیریت ادمین‌ها",
        btn_rank_list_management: "🏆 مدیریت لیست رنک",
        btn_manage_account: "🔧 مدیریت اکانت",
        btnBack: "🔙 بازگشت",
        btnBackToMainMenu: "🔙 بازگشت به منوی اصلی",
        btnBackToAccountPanel: "🔙 بازگشت به پنل اکانت",
        btnCancel: "🚫 نه، بی‌خیال",
        btnConfirmDelete: "✅ بله، حذف کن",

        // --- Admin Panel ---
        adminPanelTitle: "⚙️ بخش مدیریت ادمین‌ها",
        btnAddAdmin: "➕ افزودن ادمین",
        btnRemoveAdmin: "➖ حذف ادمین",
        btnListAdmins: "👥 لیست ادمین‌ها",
        promptAddAdmin: "لطفاً شناسه عددی \\(User ID\\) کاربر مورد نظر را ارسال کنید، یا یک پیام از او فوروارد کنید:",
        adminListTitle: "👥 *لیست ادمین‌ها:*",
        noAdminsFound: "هیچ ادمینی ثبت نشده است\\.",
        adminListEntryName: "👤 *نام*",
        adminListEntryId: "🆔 *شناسه*",
        noAdminsToRemove: "هیچ ادمینی برای حذف وجود ندارد\\.",
        promptRemoveAdmin: "کدام ادمین را می‌خواهید حذف کنید؟",
        confirmRemoveAdmin: (id) => `آیا از حذف ادمین با شناسه \`${id}\` مطمئن هستید؟`,

        // --- RCON Menu ---
        rconMenuTitle: "لطفاً سرور خود را انتخاب کنید یا یک سرور جدید اضافه/حذف کنید:",
        rconMenuTitleNoServers: "هیچ سروری ثبت نشده است\\. برای شروع یک سرور اضافه کنید:",
        btnAddServer: "➕ افزودن سرور",
        btnRemoveServer: "➖ حذف سرور",
        promptAddServerIP: "لطفاً آدرس IP یا دامنه سرور را وارد کنید:",
        rconConnecting: (serverName) => `🔄 *در حال اتصال\\.\\.\\.*\n\nلطفاً صبر کنید\\.\\.\\.`,
        rconSuccess: (serverName) => `✅ *اتصال موفق\\!*\n\nشما الان به سرور *${escapeMarkdownV2Internal(serverName)}* متصل هستید\\.\n\n💡 *راهنما:*\n• دستورات خود را مستقیماً ارسال کنید\n• برای قطع اتصال: \`/disconnect\``,
        rconFailed: (serverName, error) => `❌ *اتصال ناموفق بود\\!*\n\n*سرور:* ${escapeMarkdownV2Internal(serverName)}\n*دلیل:* \`${error}\`\n\n🔧 لطفاً:\n• اطلاعات سرور را چک کنید\n• از فعال بودن سرور مطمئن شوید`,
        errorNoServersToDelete: "هیچ سروری برای حذف کردن وجود ندارد.",
        promptDeleteServer: "کدام سرور را می‌خواهید حذف کنید؟",
        confirmDeleteServer: "آیا از حذف این سرور مطمئن هستید؟ این عمل قابل بازگشت نیست.",
        deleteServerSuccess: "✅ سرور با موفقیت حذف شد.",
        
        // --- Account Panel ---
        accountPanelTitle: "🔧 *پنل مدیریت اکانت*\n\nاز گزینه‌های زیر برای مدیریت حساب کاربری خود استفاده کنید:",
        btnReferralInfo: "💎 کسب درآمد و زیرمجموعه‌گیری",
        referralInfoMessage: (link) => `💎 *با دعوت از دوستات، هم بازی کن هم درآمد داشته باش\\!*\n\nاین لینک جادویی توئه\\! هر کسی باهاش بیاد تو سرور، تو رو برای همیشه پولدار می‌کنه\\! 😉\n\n*لینک دعوت تو:*\n\`${link}\`\n\\(روی لینک بالا کلیک کن تا کپی بشه\\)\n\n*چطوری؟ اینجوری:*\n\\- هر خریدی که دوستات بکنن، *۲۵ درصدش* مستقیم میره تو جیب تو\\!\n\\- حتی اگه دوستات هم کسی رو دعوت کنن، *۵ درصد* از خرید اونها هم برای توئه\\!\n\nهمین الان لینک رو برای دوستات بفرست و تیم خودت رو بساز\\!`,

        // --- Registration ---
        registrationWelcome: "👋 *سلام و خوش آمدید\\!*\n\nبرای بازی در سرور، لطفاً ابتدا ثبت\\-نام کنید\\.\n\n✨ فقط *چند دقیقه* زمان می‌برد\\!",
        btnStartRegistration: "🚀 شروع ثبت‌نام",
        promptEdition: "📦 *انتخاب نسخه بازی*\n\nلطفاً نسخه Minecraft خود را انتخاب کنید:",
        btnJavaEdition: "☕️ Java Edition",
        btnBedrockEdition: "📱 Bedrock Edition (موبایل/کنسول)",
        promptUsername: "✅ عالی\\! نسخه شما ثبت شد\\.\n\n👤 *نام کاربری خود در بازی را وارد کنید:*\n\n⚠️ دقت کنید:\n• فقط حروف انگلیسی، اعداد و \\_\n• بین 3 تا 16 کاراکتر\n• دقیقاً مثل نام کاربری Minecraft شما",
        errorInvalidUsername: "❌ *نام کاربری نامعتبر است\\!*\n\n✅ نام کاربری باید:\n• بین 3 تا 16 کاراکتر باشد\n• فقط شامل حروف انگلیسی، اعداد و \\_ باشد\n• فاصله نداشته باشد\n\nلطفاً دوباره تلاش کنید\\.",
        errorUsernameTaken: (admin) => `شما مجاز به استفاده از این نام کاربری نیستید زیرا توسط فرد دیگری گرفته شده است\\.\nبه راهنمایی نیاز دارید؟؟؟ به @${admin} پیام بدید`,
        promptAge: (username) => `🎂 *تقریباً تمام شد\\!*\n\nنام کاربری شما: ${escapeMarkdownV2Internal(username)}\n\nلطفاً سن خود را وارد کنید:\n\nمثال: \`15\``,
        errorInvalidAge: "❌ سن وارد شده معتبر نیست\\.\n\nلطفاً یک عدد بین 10 تا 70 وارد کنید\\.",
        registrationSuccess: "🎉 *ثبت‌نام شما با موفقیت انجام شد\\!*\n\n📝 برای فعال‌سازی نهایی حساب، روی دکمه زیر کلیک کنید\\.\n\n⏱ این فرآیند فقط چند ثانیه طول می‌کشد\\.",
        btnFinalizeRegistration: "✅ فعال‌سازی حساب کاربری",
        errorRegistrationFailed: "❌ متاسفانه در مرحله آخر ثبت‌نام خطایی رخ داد\\. لطفاً بعداً دوباره تلاش کنید\\.",

        // --- Verification ---
        btnPlayerStats: "📊 آمار بازی من",
        btnVerifyAccount: "🔐 اتصال اکانت به بازی",
        btnVerifyFromBot: "۱. دریافت کد از ربات",
        btnVerifyFromGame: "۲. دریافت کد از بازی",
        btnBackToVerifyMenu: "🔙 بازگشت به منوی وریفای",
        verifyChooseMethod: "لطفاً روش اتصال اکانت را انتخاب کنید:",
        verifyInstructionsBotToGame: (username, code) => `✅ کد شما ساخته شد\\.\n\nنام کاربری شما: \`${username}\`\nکد وریفای: \`${code}\`\n\nلطفاً وارد سرور ماینکرفت شده و دستور زیر را در چت وارد کنید:\n\`/verify ${code}\``,
        verifyInstructionsGameToBot: "برای دریافت کد، لطفاً وارد سرور ماینکرفت شده و دستور `/verify` را در چت وارد کنید\\. سپس کد ۶ رقمی که دریافت می‌کنید را در همین چت برای من ارسال کنید\\.",
        verificationSuccess: (username) => `✅ احراز هویت شما با موفقیت انجام شد\\!\nاکانت تلگرام شما به اکانت ماینکرفت \`${username}\` متصل شد\\.`,
        verificationFailedInvalidCode: "⚠️ کد وارد شده نامعتبر یا منقضی شده است\\.",
        verificationFailedMismatch: "❌ این کد وریفای متعلق به اکانت ماینکرفت شما نیست\\.",
        verificationFailedError: "❌ خطایی در فرآیند وریفای رخ داد\\. لطفاً با پشتیبانی تماس بگیرید\\.",
        promptEnterCodeFromGame: "✅ درخواست شما دریافت شد\\! کد ۶ رقمی که در بازی برایت ارسال شد را در همین چت وارد کن\\.",

        // --- Admin Commands ---
        usageDelCommand: "استفاده صحیح: `/del <UUID>`",
        delSuccess: (uuid) => `✅ درخواست ثبت‌نام با UUID \`${uuid}\` با موفقیت حذف شد\\.`,
        delNotFound: (uuid) => `⚠️ درخواستی با UUID \`${uuid}\` پیدا نشد\\.`,
        delError: "❌ خطایی در هنگام حذف از دیتابیس رخ داد\\.",

        // --- Wizard Messages ---
        wizardCancelled: "عملیات لغو شد\\.",
        wizardError: "یک خطای پیش‌بینی نشده در ویزارد رخ داد\\. عملیات لغو شد\\.",
        btnCancelAndBack: "❌ لغو و بازگشت",
        promptServerPort: "عالی\\! حالا پورت سرور را وارد کنید:",
        promptServerPassword: "بسیار خب\\. حالا رمز \\(password\\) سرور RCON را وارد کنید:",
        promptServerName: "و در آخر، چه نامی برای این سرور ذخیره شود؟ \\(این نام باید یکتا باشد\\)",
        testingConnection: (name) => `🔄 *در حال اتصال\\.\\.\\.*\n\nسرور "${escapeMarkdownV2Internal(name)}" ذخیره شد\\. لطفاً صبر کنید\\.\\.\\.`,
        connectionSuccess: "✅ سرور با موفقیت ذخیره و اتصال به آن تست شد\\!",
        errorServerDuplicate: (name) => `⚠️ خطا: سروری با نام "${escapeMarkdownV2Internal(name)}" از قبل وجود دارد\\. لطفاً دوباره تلاش کنید\\.`,
        errorConnectionFailed: "❌ سرور ذخیره شد، اما اتصال به RCON ناموفق بود\\. لطفاً اطلاعات را بررسی کنید\\.",
        btnRetryConnection: "🔁 تلاش مجدد برای اتصال",
        btnEditServer: "✏️ ویرایش اطلاعات سرور",
        promptAdminName: (id) => `شناسه کاربر \\(${id}\\) دریافت شد\\. حالا یک نام برای این ادمین وارد کنید:`,
        errorInvalidAdminId: "خطا: لطفاً یک شناسه عددی معتبر وارد کنید یا یک پیام از کاربر مورد نظر فوروارد کنید\\.",
        addAdminSuccess: (name, id) => `✅ ادمین جدید با نام "${escapeMarkdownV2Internal(name)}" و شناسه "${id}" با موفقیت اضافه شد\\.`,
        errorAdminDuplicate: "⚠️ این کاربر از قبل ادمین است\\.",
        errorAddAdminFailed: "❌ خطایی در ذخیره ادمین رخ داد\\.",

        // --- Rank Manager ---
        rankManagerTitle: "📋 *مدیریت لیست رنک‌ها*",
        rankManagerConfiguredGroups: "گروه‌های تنظیم شده فعلی \\(به ترتیب نمایش\\)",
        rankManagerNoGroups: "هنوز هیچ گروهی برای نمایش تنظیم نشده است\\.",
        btnRankMgrAddGroup: "➕ افزودن گروه",
        btnRankMgrDeleteGroup: "➖ حذف گروه",
        btnRankMgrSort: "↕️ تغییر ترتیب",
        btnRankMgrAddTime: "⏰ افزودن زمان",
        btnRankMgrSettings: "⚙️ تنظیمات ارسال",
        btnRankMgrExit: "❌ خروج",
        gettingGroupList: "در حال دریافت لیست گروه‌ها\\.\\.\\.",
        errorAllGroupsAdded: "تمام گروه‌های ممکن قبلاً اضافه شده‌اند\\.",
        promptAddGroup: "کدام گروه را می‌خواهید اضافه کنید؟",
        promptGroupDisplayName: (groupName) => `نام نمایشی که می‌خواهید برای گروه \`${groupName}\` استفاده شود را وارد کنید \\(مثلاً: ادمین‌ها\\)`,
        promptGroupTemplate: "عالی\\! حالا **قالب کلی گروه** را ارسال کنید\\.\n\\- `#t`: نام نمایشی گروه\n\\- `#p`: لیست بازیکنان\n*نمونه:*\n`--- 👑 #t 👑 ---\n#p`",
        promptPlayerTemplate: "بسیار خب\\! حالا **قالب هر بازیکن** را ارسال کنید\\.\n\\- `#p`: نام بازیکن\n\\- `#t`: زمان باقی‌مانده\n*نمونه:*\n`\\- #p | #t`",
        addGroupSuccess: (displayName) => `✅ گروه *${displayName}* با موفقیت اضافه شد\\.`,
        errorAddGroupFailed: "❌ خطایی در ذخیره گروه رخ داد\\.",
        errorNoGroupsToDelete: "هیچ گروهی برای حذف وجود ندارد\\.",
        promptDeleteGroup: "کدام گروه را می‌خواهید حذف کنید؟",
        deleteGroupSuccess: (groupName) => `گروه ${groupName} با موفقیت حذف شد\\.`,
        btnSaveChangesAndBack: "✅ ذخیره و بازگشت",
        promptSortGroups: "ترتیب نمایش گروه‌ها را با دکمه‌های 🔼 و 🔽 تنظیم کنید:",
        promptAddTimeSelectGroups: "می‌خواهید به کدام گروه‌ها زمان اضافه کنید؟ \\(می‌توانید چند مورد را انتخاب کنید\\)",
        errorSelectAtLeastOneGroup: "لطفاً حداقل یک گروه را انتخاب کنید\\.",
        promptAddTimeAmount: (groups) => `گروه‌های انتخاب شده: \`${groups}\`\n\nچه مقدار زمان می‌خواهید اضافه کنید؟`,
        errorSelectTimeAmount: "لطفاً مقدار زمانی برای افزودن انتخاب کنید\\.",
        addingTimeInProgress: "⏳ در حال افزودن زمان به بازیکنان\\.\\.\\.",
        addTimeSuccess: (success, error) => `✅ عملیات انجام شد\\.\n\\- گروه‌های موفق: ${success}\n\\- گروه‌های ناموفق: ${error}`,
        btnNext: "بعدی »",
        btnConfirm: "✅ تایید",
        timeAdjustmentDisplay: (d, h, m) => `زمان اضافه شده: ${d} روز, ${h} ساعت, ${m} دقیقه`,
        btnSub5Min: "\\-5 دقیقه",
        btnAdd5Min: "\\+5 دقیقه",
        btnSub1Hour: "\\-1 ساعت",
        btnAdd1Hour: "\\+1 ساعت",
        btnSub1Day: "\\-1 روز",
        btnAdd1Day: "\\+1 روز",
        settingCurrentInterval: (interval) => `⏰ زمان ارسال: ${interval} دقیقه`,
        promptSetInterval: "بازه زمانی برای ارسال خودکار لیست رنک‌ها را تنظیم کنید \\(0 برای غیرفعال کردن\\):",
        settingsSavedAndApplied: "تنظیمات ذخیره و اعمال شد\\!",
        settingsSavedRestartNeeded: "تنظیمات ذخیره شد\\! برای اعمال، نیاز به ری‌استارت بات است\\.",
    },
    en: {
        // --- General ---
        greeting_admin: "Hello\\! 👋 Choose an option to get started\\.",
        greeting_user_approved: "🎉 Welcome to your user panel\\!\n\nYou can manage your account and get your referral link using the button below\\.",
        error_generic: "❌ An error occurred while checking your status\\. Please try again later\\.",
        errorMenu: "An error occurred displaying the menu\\. Please try again\\.",
        permission_denied: "⛔️ You are not authorized to access this section.",
        errorServerNotFound: "⚠️ The requested server was not found.",

        // --- Language Selection ---
        choose_language_prompt: "لطفا زبان خود را انتخاب کنید\nPlease choose your language",
        language_changed: "✅ Language successfully changed to English\\.",

        // --- Menus & Buttons ---
        btn_rcon_menu: "Direct RCON Connection",
        btn_admin_panel: "⚙️ Admin Management",
        btn_rank_list_management: "🏆 Rank List Management",
        btn_manage_account: "🔧 Manage Account",
        btnBack: "🔙 Back",
        btnBackToMainMenu: "🔙 Back to Main Menu",
        btnBackToAccountPanel: "🔙 Back to Account Panel",
        btnCancel: "🚫 No, Cancel",
        btnConfirmDelete: "✅ Yes, Delete",

        // --- Admin Panel ---
        adminPanelTitle: "⚙️ Admin Management",
        btnAddAdmin: "➕ Add Admin",
        btnRemoveAdmin: "➖ Remove Admin",
        btnListAdmins: "👥 List Admins",
        promptAddAdmin: "Please send the numeric User ID of the target user, or forward a message from them:",
        adminListTitle: "👥 *List of Admins:*",
        noAdminsFound: "No admins have been registered\\.",
        adminListEntryName: "👤 *Name*",
        adminListEntryId: "🆔 *ID*",
        noAdminsToRemove: "There are no admins to remove\\.",
        promptRemoveAdmin: "Which admin do you want to remove?",
        confirmRemoveAdmin: (id) => `Are you sure you want to remove the admin with ID \`${id}\`?`,

        // --- RCON Menu ---
        rconMenuTitle: "Please select your server or add/remove a new one:",
        rconMenuTitleNoServers: "No servers have been registered\\. Add a server to get started:",
        btnAddServer: "➕ Add Server",
        btnRemoveServer: "➖ Remove Server",
        promptAddServerIP: "Please enter the server's IP address or domain:",
        rconConnecting: (serverName) => `🔄 *Connecting\\.\\.\\.*\n\nPlease wait\\.\\.\\.`,
        rconSuccess: (serverName) => `✅ *Connection Successful\\!*\n\nYou are now connected to *${escapeMarkdownV2Internal(serverName)}*\\.\n\n💡 *Tip:*\n• Send your commands directly\n• Use \`/disconnect\` to exit\\.`,
        rconFailed: (serverName, error) => `❌ *Connection Failed\\!*\n\n*Server:* ${escapeMarkdownV2Internal(serverName)}\n*Reason:* \`${error}\`\n\n🔧 Please:\n• Check your server details\n• Ensure the server is online`,
        errorNoServersToDelete: "There are no servers to delete.",
        promptDeleteServer: "Which server do you want to delete?",
        confirmDeleteServer: "Are you sure you want to delete this server? This action cannot be undone.",
        deleteServerSuccess: "✅ Server successfully deleted.",

        // --- Account Panel ---
        accountPanelTitle: "🔧 *Account Management Panel*\n\nUse the options below to manage your account:",
        btnReferralInfo: "💎 Earn Money & Referrals",
        referralInfoMessage: (link) => `💎 *Play and earn by inviting your friends\\!*\n\nThis is your magic link\\! Anyone who joins the server with it will make you rich forever\\! 😉\n\n*Your invite link:*\n\`${link}\`\n\\(Click the link above to copy it\\)\n\n*How does it work? Like this:*\n\\- For every purchase your friends make, *25%* of it goes directly into your pocket\\!\n\\- Even if your friends invite someone, you get *5%* of their purchases too\\!\n\nSend this link to your friends right now and build your team\\!`,

        // --- Registration ---
        registrationWelcome: "👋 *Welcome to the Otherland bot\\!*\n\nTo play on the server, please register first\\.\n\n✨ It only takes *a few minutes*\\!",
        btnStartRegistration: "🚀 Start Registration",
        promptEdition: "📦 *Select Game Edition*\n\nPlease select your Minecraft edition:",
        btnJavaEdition: "☕️ Java Edition",
        btnBedrockEdition: "📱 Bedrock Edition (Mobile/Console)",
        promptUsername: "✅ Great\\! Your edition has been saved\\.\n\n👤 *Enter your exact in\\-game username:*\n\n⚠️ Note:\n• Only English letters, numbers, and \\_\n• Between 3 and 16 characters\n• Exactly as your Minecraft username",
        errorInvalidUsername: "❌ *Invalid Username\\!*\n\n✅ Username must be:\n• Between 3 and 16 characters\n• Contain only English letters, numbers, and \\_\n• Have no spaces\n\nPlease try again\\.",
        errorUsernameTaken: (admin) => `You are not allowed to use this username because it has been taken by someone else\\.\nNeed help? Message @${admin}`,
        promptAge: (username) => `🎂 *Almost Done\\!*\n\nYour Username: ${escapeMarkdownV2Internal(username)}\n\nPlease enter your age:\n\nExample: \`15\``,
        errorInvalidAge: "❌ The entered age is not valid\\. Please enter a number between 10 and 70\\.",
        registrationSuccess: "🎉 *Your registration was successful\\!*\n\n📝 To finalize account activation, click the button below\\.\n\n⏱ This process only takes a few seconds\\.",
        btnFinalizeRegistration: "✅ Activate Account",
        errorRegistrationFailed: "❌ Unfortunately, an error occurred during the final step of registration\\. Please try again later\\.",

        // --- Verification ---
        btnPlayerStats: "📊 My Game Stats",
        btnVerifyAccount: "🔐 Link Account to Game",
        btnVerifyFromBot: "1. Get Code from Bot",
        btnVerifyFromGame: "2. Get Code from Game",
        btnBackToVerifyMenu: "🔙 Back to Verification Menu",
        verifyChooseMethod: "Please choose a method to link your account:",
        verifyInstructionsBotToGame: (username, code) => `✅ Your code has been generated\\.\n\nYour Username: \`${username}\`\nVerification Code: \`${code}\`\n\nPlease log in to the Minecraft server and enter the following command in the chat:\n\`/verify ${code}\``,
        verifyInstructionsGameToBot: "To get a code, please log in to the Minecraft server and type `/verify` in the chat\\. Then, send the 6-digit code you receive back to me in this chat\\.",
        verificationSuccess: (username) => `✅ Your identity has been successfully verified\\!\nYour Telegram account is now linked to the Minecraft account \`${username}\`\\.`,
        verificationFailedInvalidCode: "⚠️ The entered code is invalid or has expired\\.",
        verificationFailedMismatch: "❌ This verification code does not belong to your Minecraft account\\.",
        verificationFailedError: "❌ An error occurred during the verification process\\. Please contact support\\.",
        promptEnterCodeFromGame: "✅ Your request has been received\\! Please enter the 6-digit code you just received in-game into this chat\\.",

        // --- Admin Commands ---
        usageDelCommand: "Correct usage: `/del <UUID>`",
        delSuccess: (uuid) => `✅ Registration request with UUID \`${uuid}\` was successfully deleted\\.`,
        delNotFound: (uuid) => `⚠️ No request with UUID \`${uuid}\` was found\\.`,
        delError: "❌ An error occurred while deleting from the database\\.",

        // --- Wizard Messages ---
        wizardCancelled: "Operation cancelled\\.",
        wizardError: "An unexpected error occurred in the wizard\\. Operation cancelled\\.",
        btnCancelAndBack: "❌ Cancel and Go Back",
        promptServerPort: "Great\\! Now enter the server port:",
        promptServerPassword: "Alright\\. Now enter the RCON server password:",
        promptServerName: "Finally, what name should this server be saved as? \\(This name must be unique\\)",
        testingConnection: (name) => `🔄 *Connecting\\.\\.\\.*\n\nServer "${escapeMarkdownV2Internal(name)}" saved\\. Please wait\\.\\.\\.`,
        connectionSuccess: "✅ Server successfully saved and connection tested\\!",
        errorServerDuplicate: (name) => `⚠️ Error: A server with the name "${escapeMarkdownV2Internal(name)}" already exists\\. Please try again\\.`,
        errorConnectionFailed: "❌ Server was saved, but the RCON connection failed\\. Please check the information\\.",
        btnRetryConnection: "🔁 Retry Connection",
        btnEditServer: "✏️ Edit Server Info",
        promptAdminName: (id) => `User ID \\(${id}\\) received\\. Now, enter a name for this admin:`,
        errorInvalidAdminId: "Error: Please enter a valid numeric ID or forward a message from the target user\\.",
        addAdminSuccess: (name, id) => `✅ New admin "${escapeMarkdownV2Internal(name)}" with ID "${id}" was added successfully\\.`,
        errorAdminDuplicate: "⚠️ This user is already an admin\\.",
        errorAddAdminFailed: "❌ An error occurred while saving the admin\\.",
        
        // --- Rank Manager ---
        rankManagerTitle: "📋 *Rank List Management*",
        rankManagerConfiguredGroups: "Currently configured groups \\(in display order\\)",
        rankManagerNoGroups: "No groups have been configured for display yet\\.",
        btnRankMgrAddGroup: "➕ Add Group",
        btnRankMgrDeleteGroup: "➖ Delete Group",
        btnRankMgrSort: "↕️ Change Order",
        btnRankMgrAddTime: "⏰ Add Time",
        btnRankMgrSettings: "⚙️ Sending Settings",
        btnRankMgrExit: "❌ Exit",
        gettingGroupList: "Getting group list\\.\\.\\.",
        errorAllGroupsAdded: "All possible groups have already been added\\.",
        promptAddGroup: "Which group do you want to add?",
        promptGroupDisplayName: (groupName) => `Enter the display name you want to use for the \`${groupName}\` group \\(e\\.g\\., Admins\\)`,
        promptGroupTemplate: "Great\\! Now, send the **overall group template**\\.\n\\- `#t`: Group display name\n\\- `#p`: Player list\n*Example:*\n`--- 👑 #t 👑 ---\n#p`",
        promptPlayerTemplate: "Alright\\! Now, send the **template for each player**\\.\n\\- `#p`: Player name\n\\- `#t`: Time remaining\n*Example:*\n`\\- #p | #t`",
        addGroupSuccess: (displayName) => `✅ Group *${displayName}* was added successfully\\.`,
        errorAddGroupFailed: "❌ An error occurred while saving the group\\.",
        errorNoGroupsToDelete: "There are no groups to delete\\.",
        promptDeleteGroup: "Which group do you want to delete?",
        deleteGroupSuccess: (groupName) => `Group ${groupName} was successfully deleted\\.`,
        btnSaveChangesAndBack: "✅ Save and Back",
        promptSortGroups: "Set the display order of the groups with the 🔼 and 🔽 buttons:",
        promptAddTimeSelectGroups: "Which groups do you want to add time to? \\(You can select multiple\\)",
        errorSelectAtLeastOneGroup: "Please select at least one group\\.",
        promptAddTimeAmount: (groups) => `Selected groups: \`${groups}\`\n\nHow much time do you want to add?`,
        errorSelectTimeAmount: "Please select an amount of time to add\\.",
        addingTimeInProgress: "⏳ Adding time to players\\.\\.\\.",
        addTimeSuccess: (success, error) => `✅ Operation complete\\.\n\\- Successful groups: ${success}\n\\- Failed groups: ${error}`,
        btnNext: "Next »",
        btnConfirm: "✅ Confirm",
        timeAdjustmentDisplay: (d, h, m) => `Time to add: ${d} days, ${h} hours, ${m} minutes`,
        btnSub5Min: "\\-5 min",
        btnAdd5Min: "\\+5 min",
        btnSub1Hour: "\\-1 hour",
        btnAdd1Hour: "\\+1 hour",
        btnSub1Day: "\\-1 day",
        btnAdd1Day: "\\+1 day",
        settingCurrentInterval: (interval) => `⏰ Sending interval: ${interval} minutes`,
        promptSetInterval: "Set the time interval for automatically sending the rank list \\(0 to disable\\):",
        settingsSavedAndApplied: "Settings saved and applied\\!",
        settingsSavedRestartNeeded: "Settings saved\\! A bot restart is required to apply them\\.",
    }
};

function getText(userLang, key, ...args) {
    const lang = (userLang && languages[userLang]) ? userLang : 'fa';
    const template = languages[lang][key];

    if (template === undefined) {
        console.warn(`[i18n] Missing translation for key: ${key} in language: ${lang}`);
        return key;
    }

    if (typeof template === 'function') {
        return template(...args);
    }
    return template;
}

module.exports = {
    getText
};