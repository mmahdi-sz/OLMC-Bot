/**
 * کاراکترهای خاص برای MarkdownV2 را escape می‌کند.
 * این تابع به صورت داخلی در i18n.js استفاده می‌شود.
 */
function escapeMarkdownV2Internal(text) {
    if (typeof text !== 'string') return '';
    // کاراکترهای رزرو شده در MarkdownV2
    // [ _ * [ ] ( ) ~ ` > # + - = | { } . ! ]
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

const languages = {

    fa: {
        // --- General ---
        greeting_admin: "سلام\\! 👋 برای شروع یکی از گزینه‌ها را انتخاب کن\\.",
        greeting_user_approved: "🎉 به پنل کاربری خود خوش آمدید\\!\n\nاز طریق دکمه زیر می‌توانید اکانت خود را مدیریت کرده و لینک زیرمجموعه‌گیری خود را دریافت کنید\\.",
        greeting_user_pending: (admin, uuid) => {
            const escapedAdmin = escapeMarkdownV2Internal(admin);
            return `⏳ ثبت‌نام اولیه شما انجام شده ولی هنوز نهایی نشده است\\.\nلطفاً کد زیر را کپی کرده و برای ادمین پشتیبانی ارسال کنید:\n👤 *ادمین:* @${escapedAdmin}\nکد شما:\n\`${uuid}\``;
        },
        error_generic: "❌ خطایی در بررسی وضعیت شما رخ داد\\. لطفاً بعداً دوباره تلاش کنید\\.",
        errorMenu: "خطایی در نمایش منو رخ داد\\. لطفاً دوباره تلاش کنید\\.",
        
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

        // --- Account Panel ---
        accountPanelTitle: "🔧 *پنل مدیریت اکانت*\n\nاز گزینه‌های زیر برای مدیریت حساب کاربری خود استفاده کنید:",
        btnReferralInfo: "💎 کسب درآمد و زیرمجموعه‌گیری",
        referralInfoMessage: (link) => `💎 *با دعوت از دوستات، هم بازی کن هم درآمد داشته باش\\!*\n\nاین لینک جادویی توئه\\! هر کسی باهاش بیاد تو سرور، تو رو برای همیشه پولدار می‌کنه\\! 😉\n\n*لینک دعوت تو:*\n\`${link}\`\n\\(روی لینک بالا کلیک کن تا کپی بشه\\)\n\n*چطوری؟ اینجوری:*\n\\- هر خریدی که دوستات بکنن، *۲۵ درصدش* مستقیم میره تو جیب تو\\!\n\\- حتی اگه دوستات هم کسی رو دعوت کنن، *۵ درصد* از خرید اونها هم برای توئه\\!\n\nهمین الان لینک رو برای دوستات بفرست و تیم خودت رو بساز\\!`,

        // --- Registration ---
        registrationWelcome: "👋 سلام، به بات ادرلend خوش آمدید\\.\nبرای شروع فرآیند ثبت‌نام در سرور، روی دکمه زیر کلیک کنید\\.",
        btnStartRegistration: "📝 ثبت نام در سرور",
        promptEdition: "لطفا نسخه بازی خود را انتخاب کنید:",
        btnJavaEdition: "☕️ جاوا ادیشن",
        btnBedrockEdition: "📱 بدراک ادیشن",
        promptUsername: "✅ نسخه بازی شما ثبت شد\\.\n\nلطفاً نام کاربری دقیق خود را در بازی وارد کنید:",
        errorInvalidUsername: "⚠️ نام کاربری نامعتبر است\\.\nنام کاربری باید بین ۳ تا ۱۶ کاراکتر باشد و فقط شامل حروف انگلیسی، اعداد و خط زیر \\(\\_\\) باشد\\. لطفاً دوباره تلاش کنید\\.",
        errorUsernameTaken: (admin) => `شما مجاز به استفاده از این نام کاربری نیستید زیرا توسط فرد دیگری گرفته شده است\\.\nبه راهنمایی نیاز دارید؟؟؟ به @${admin} پیام بدید`,
        promptAge: (username) => `✅ نام کاربری "${username}" ثبت شد\\.\n\nلطفا سن خود را وارد کنید\nمانند: \`15\``,
        errorInvalidAge: "⚠️ سن وارد شده معتبر نیست\\. لطفاً یک عدد بین ۱۰ تا ۷۰ وارد کنید\\.",
        registrationSuccess: (admin) => {
            const escapedAdmin = escapeMarkdownV2Internal(admin);
            return `✅ ثبت‌نام اولیه شما با موفقیت انجام شد\\!\\n\\nاین کد ثبت‌نام شماست\\. لطفاً آن را کپی کرده و برای ادمین پشتیبانی \\(@${escapedAdmin}\\) ارسال کنید تا ثبت‌نام شما نهایی شود\\.`;
        },
        errorRegistrationFailed: "❌ متاسفانه در مرحله آخر ثبت‌نام خطایی رخ داد\\. لطفاً بعداً دوباره تلاش کنید\\.",

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
        testingConnection: (name) => `⏳ سرور "${name}" ذخیره شد\\. در حال تست اتصال\\.\\.\\.`,
        connectionSuccess: "✅ سرور با موفقیت ذخیره و اتصال به آن تست شد\\!",
        errorServerDuplicate: (name) => `⚠️ خطا: سروری با نام "${name}" از قبل وجود دارد\\. لطفاً دوباره تلاش کنید\\.`,
        errorConnectionFailed: "❌ سرور ذخیره شد، اما اتصال به RCON ناموفق بود\\. لطفاً اطلاعات را بررسی کنید\\.",
        btnRetryConnection: "🔁 تلاش مجدد برای اتصال",
        btnEditServer: "✏️ ویرایش اطلاعات سرور",
        promptAdminName: (id) => `شناسه کاربر \\(${id}\\) دریافت شد\\. حالا یک نام برای این ادمین وارد کنید:`,
        errorInvalidAdminId: "خطا: لطفاً یک شناسه عددی معتبر وارد کنید یا یک پیام از کاربر مورد نظر فوروارد کنید\\.",
        addAdminSuccess: (name, id) => `✅ ادمین جدید با نام "${name}" و شناسه "${id}" با موفقیت اضافه شد\\.`,
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
        greeting_user_pending: (admin, uuid) => {
            const escapedAdmin = escapeMarkdownV2Internal(admin);
            return `⏳ Your initial registration is complete but not yet finalized\\.\nPlease copy the code below and send it to the support admin:\n👤 *Admin:* @${escapedAdmin}\nYour code:\n\`${uuid}\``;
        },
        error_generic: "❌ An error occurred while checking your status\\. Please try again later\\.",
        errorMenu: "An error occurred displaying the menu\\. Please try again\\.",
        
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

        // --- Account Panel ---
        accountPanelTitle: "🔧 *Account Management Panel*\n\nUse the options below to manage your account:",
        btnReferralInfo: "💎 Earn Money & Referrals",
        referralInfoMessage: (link) => `💎 *Play and earn by inviting your friends\\!*\n\nThis is your magic link\\! Anyone who joins the server with it will make you rich forever\\! 😉\n\n*Your invite link:*\n\`${link}\`\n\\(Click the link above to copy it\\)\n\n*How does it work? Like this:*\n\\- For every purchase your friends make, *25%* of it goes directly into your pocket\\!\n\\- Even if your friends invite someone, you get *5%* of their purchases too\\!\n\nSend this link to your friends right now and build your team\\!`,

        // --- Registration ---
        registrationWelcome: "👋 Welcome to the Otherland bot\\.\nClick the button below to start the registration process for the server\\.",
        btnStartRegistration: "📝 Register on the Server",
        promptEdition: "Please select your game edition:",
        btnJavaEdition: "☕️ Java Edition",
        btnBedrockEdition: "📱 Bedrock Edition",
        promptUsername: "✅ Your game edition has been saved\\.\n\nPlease enter your exact in\\-game username:",
        errorInvalidUsername: "⚠️ Invalid username\\.\nThe username must be between 3 and 16 characters and can only contain English letters, numbers, and underscores \\(\\_\\)\\. Please try again\\.",
        errorUsernameTaken: (admin) => `You are not allowed to use this username because it has been taken by someone else\\.\nNeed help? Message @${admin}`,
        promptAge: (username) => `✅ Username "${username}" has been saved\\.\n\nPlease enter your age\nExample: \`15\``,
        errorInvalidAge: "⚠️ The entered age is not valid\\. Please enter a number between 10 and 70\\.",
        registrationSuccess: (admin) => {
            const escapedAdmin = escapeMarkdownV2Internal(admin);
            return `✅ Your initial registration was successful\\!\\n\\nThis is your registration code\\. Please copy it and send it to the support admin \\(@${escapedAdmin}\\) to finalize your registration\\.`;
        },
        errorRegistrationFailed: "❌ Unfortunately, an error occurred during the final step of registration\\. Please try again later\\.",

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
        testingConnection: (name) => `⏳ Server "${name}" saved\\. Testing connection\\.\\.\\.`,
        connectionSuccess: "✅ Server successfully saved and connection tested\\!",
        errorServerDuplicate: (name) => `⚠️ Error: A server with the name "${name}" already exists\\. Please try again\\.`,
        errorConnectionFailed: "❌ Server was saved, but the RCON connection failed\\. Please check the information\\.",
        btnRetryConnection: "🔁 Retry Connection",
        btnEditServer: "✏️ Edit Server Info",
        promptAdminName: (id) => `User ID \\(${id}\\) received\\. Now, enter a name for this admin:`,
        errorInvalidAdminId: "Error: Please enter a valid numeric ID or forward a message from the target user\\.",
        addAdminSuccess: (name, id) => `✅ New admin "${name}" with ID "${id}" was added successfully\\.`,
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

/**
 * Retrieves a translated text string.
 */
function getText(userLang, key, ...args) {
    const lang = (userLang && languages[userLang]) ? userLang : 'fa';
    const template = languages[lang][key];

    if (template === undefined) {
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