import React from 'react';
import { connect } from 'react-redux';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pushNotifications } from './../services/pushNotification/index';
import { mantraActions, userActions } from "./../redux/actions/index";

const NO_MANTRA_DAYS = -1;

class TimeNotification extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            mantra: {},
        }
    }

    componentDidMount() {
        // Fetches mantra data from AsyncStorage and schedules notifications.
        this.fetchMantraFromStorage();

    }


    // Fetches mantra data from AsyncStorage and updates component state.
    async fetchMantraFromStorage() {
        let mantra = await AsyncStorage.getItem('mantra');
        if (mantra) {
            mantra = JSON.parse(mantra)
            this.setState({
                mantra,
            })
            // If mantra data exists, triggers the scheduling of notifications.
            this.scheduleNotifications()
        }

    }


    // Schedules notifications for today and upcoming days based on mantra data.
    //   Cancels any previously scheduled notifications before creating new ones.
    scheduleNotifications() {
        pushNotifications.cancelAllLocalNotifications();
        const { mantra } = this.state;
        const notifications = mantra.notifications;
        const daysLeft = mantra.answer?.days_left || NO_MANTRA_DAYS;

        if (daysLeft === NO_MANTRA_DAYS) return;

        // Schedule notification for the present day if time is in the future
        this.scheduleTodayNotifications(notifications);

        // Schedule notifications for upcoming days
        for (let i = 1; i < daysLeft; i++) {
            this.scheduleFutureNotification(i, notifications);
        }
    }

    // Schedules notifications for the current day if the time has not passed.
    scheduleTodayNotifications(notifications) {
        const currentDate = new Date();
        const currentHour = currentDate.getHours();
        const currentMinute = currentDate.getMinutes();

        const todayNotification = notifications[currentDate.getDay()];
        if (todayNotification && currentHour <= todayNotification.time.hour) {
            if (currentHour < todayNotification.time.hour || currentMinute < todayNotification.time.minutes) {
                const data = {
                    year: currentDate.getFullYear(),
                    month: currentDate.getMonth(),
                    date: currentDate.getDate(),
                    hours: todayNotification.time.hour,
                    minutes: todayNotification.time.minutes,
                };
                this.scheduleNotification(data);
            }
        }
    }

    // Schedules notifications for upcoming days based on the remaining days.
    scheduleFutureNotification(dayOffset, notifications) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + dayOffset);
        const weekDay = futureDate.getDay();

        const futureNotification = notifications[weekDay];
        if (futureNotification) {
            const data = {
                year: futureDate.getFullYear(),
                month: futureDate.getMonth(),
                date: futureDate.getDate(),
                hours: futureNotification.time.hour,
                minutes: futureNotification.time.minutes,
            };
            this.scheduleNotification(data);
        }
    }

    componentDidUpdate() {
        if (this.props.updatingUser || this.props.purchaseSuccess) {
            this.refreshMantraInfo()
        }
    }


    // Fetches updated mantra data and clears user purchase info from state.
    refreshMantraInfo = () => {
        setTimeout(() => {
            this.props.dispatch(userActions.removePurchaseInfo());
            AsyncStorage.getItem("user")
                .then(
                    (token) => {
                        this.props.dispatch(mantraActions.getDailyMantra(token));
                    });
            this.fetchMantraFromStorage();
        }, 3000)
    }

    // Schedules a local push notification for a specific date and time.
    scheduleNotification(data) {
        const { mantra } = this.state;

        const notificationContent = {
            bigText: lang === "en"
                ? mantra.answer.mantra_with_translation[0].name
                : mantra.answer.mantra_with_translation[1].name,
            subText: lang === "en"
                ? mantra.category_sentences.category.translations[0].name
                : mantra.category_sentences.category.translations[1].name,
            title: this.props.i18n.t('common:pages.main_page.push_notification_title'),
            message: lang === "en"
                ? mantra.category_sentences.category.translations[0].name
                : mantra.category_sentences.category.translations[1].name,
        };
        pushNotifications.localNotificationSchedule(notificationContent, data);
    }


    render() {
        return null;
    }
}

function mapStateToProps(state) {
    const {
        fetchMantraFromStorageSuccess,
    } = state.mantraReducer;
    const {
        selectedNotifications
    } = state.notificationsReducer;
    const {
        updatingUser,
        purchaseSuccess,
    } = state.userReducer;
    const { lang } = state.languageReducer;
    return {
        fetchMantraFromStorageSuccess,
        selectedNotifications,
        updatingUser,
        purchaseSuccess,
        lang
    };
}

export default connect(mapStateToProps)(TimeNotification);





import React from "react";
import PushNotification from 'react-native-push-notification';


const configure = () => {
    PushNotification.configure({

        onRegister: function (token) {
            console.log('TOKEN:', token);
        },

        onNotification: function (notification) {
            console.log("NOTIFICATION:", notification);


        },
        requestPermissions: Platform.OS === 'ios',
        senderID: "...",
        permissions: {
            alert: true,
            badge: true,
            sound: true
        },
        popInitialNotification: true,
        requestPermissions: true,
    });

};

const createChannel = () => {
    PushNotification.createChannel({
        channelId: "...",
        channelName: "...",
    })
}

const scheduleLocalNotification = (mantra, d) => {

    PushNotification.scheduleLocalNotification({
        channelId: "...",
        autoCancel: true,
        largeIcon: "ic_launcher",
        smallIcon: "ic_notification",
        bigText: mantra.bigText,
        subText: mantra.subText,
        color: "green",
        vibrate: true,
        vibration: 300,
        title: mantra.title,
        message: mantra.message,
        playSound: true,
        soundName: 'default',
        allowWhileIdle: true,
        date: new Date(d.year, d.month, d.date, d.hours, d.minutes),
    });
};

const cancelAllScheduledNotifications = () => {

    PushNotification.cancelAllLocalNotifications()
}



export {
    configure,
    createChannel,
    scheduleLocalNotification,
    cancelAllScheduledNotifications,
};