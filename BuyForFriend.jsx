import React from "react";
import { connect } from "react-redux";
import {
    View,
    ScrollView,
    Platform,
    Share,
    TouchableOpacity,
    Keyboard,
    SafeAreaView,
} from "react-native";
import LinearGradientInput from "../../components/LinearGradientInput";
import {
    Text,
    LinearGradientLabel,
    Spinner,
    Switch,
    CustomModal,
    Footer,
    SelectModal,
} from "../../components";
import {
    userActions,
    categoriesActions,
} from "../../redux/actions";
import { validatePhoneNumber } from "../../helpers/validators";
import styles from "./styles";
import SowUpYourLife from "../../components/SowUpYourLife";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Variables from "../../assets/styles/Variables";
import IconGift from "../../assets/images/svg/IconGift";
import { LinearGradient } from "expo-linear-gradient";
import { goBack } from "../../navigatrion/RootNavigation";

import * as RNIap from "react-native-iap";
import Header from "../../components/Header";
import Tick from "../../assets/images/svg/Tick";

let purchaseUpdateSubscription = null;

let purchaseErrorSubscription = null;

const itemSubs = Platform.select({
    ios: ["..."],
    android: ["..."],
});

class BuyForFriend extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: "",
            phone: "",
            category_id: "",
            isPurchaseForFriend: true,
            isNameIsValid: true,
            isPhoneIsValid: true,
            isCategoryIsValid: true,
            isModalVisible: false,
            isInfoModalVisible: false,
            categories: [],
            lang,
            products: {},
            isPurchaseSuccess: false,
            isErrorIAP: false,
            subId: 0,
            isSelectModal: false,
            isStartScroll: true,
            isEndScroll: true,
            categoriasName: "",
            isShowFooter: true,
        };
    }

    // Validates the receipt data for iOS in-app purchases.
    validateIOSReceipt = async (receipt) => {
        const receiptBody = {
            "receipt-data": receipt,
            password: Variables.code,
        };
        console.log(receiptBody);

        await RNIap.validateReceiptIos(receiptBody, false)
            .catch(() => { })
            .then((receipt) => {
                try {
                    console.log(typeof receipt, receipt);

                    return true;
                } catch (error) {
                    console.log("validateIOSReceipt-", error);
                }
            });
    };

    componentDidMount() {
        this.props.dispatch(categoriesActions.getCategories(this.state.lang));

        //   Initializes the in-app purchase (IAP) connection and fetches products.
        RNIap.initConnection()
            .then(async () => {
                if (Platform.OS == "android") {
                    await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
                }
            })
            .then(() => {
                console.log("connected to  store ...");
                try {
                    //  Fetches available in-app purchase products from the store.
                    RNIap.getProducts(itemSubs)
                        .catch((err) => {
                            console.log("error finding purchases", err);
                        })
                        .then((res) => {
                            console.log("get products", res);
                            this.setState({
                                products: res,
                            });
                        });
                } catch (err) {
                    console.warn("initConnection-", err);
                }
            })

            .catch((err) => {
                console.log(`IAP ERROR ${err.code}`, err.message);
            });

        purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
            async (purchase) => {

                try {
                    if (Platform.OS === "ios") {
                        const receipt = purchase.transactionReceipt;

                        if (receipt) {
                            this.validateIOSReceipt(receipt) &&
                                (await RNIap.finishTransaction(purchase, true));
                        }
                    } else {
                        await RNIap.acknowledgePurchaseAndroid(purchase.purchaseToken);
                        await RNIap.finishTransaction(purchase, true);
                    }
                } catch (ackErr) {
                    console.log("ackErr purchaseUpdatedListener", ackErr);
                }
            }
        );

        purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
            console.log("purchaseErrorListener ", error);
            if (!(error.responseCode === "2")) {
                this.setState({ isErrorIAP: true });
            }
        });
        // keyboard
        this.keyboardDidShowListener = Keyboard.addListener(
            "keyboardDidShow",
            this._keyboardDidShow.bind(this)
        );
        this.keyboardDidHideListener = Keyboard.addListener(
            "keyboardDidHide",
            this._keyboardDidHide.bind(this)
        );
    }

    componentWillUnmount() {
        if (this.purchaseUpdateSubscription) {
            this.purchaseUpdateSubscription.remove();
            this.purchaseUpdateSubscription = null;
        }
        if (this.purchaseErrorSubscription) {
            this.purchaseErrorSubscription.remove();
            this.purchaseErrorSubscription = null;
        }
        RNIap.endConnection();

        // keyboard
        this.keyboardDidShowListener.remove();
        this.keyboardDidHideListener.remove();
    }

    purchase = async (item) => {
        RNIap.requestPurchase(item)
            .then(async (result) => {
                console.log("IAP req sub_", result.purchaseToken);

                this.processPurchaseResult(result);
            })

            .catch((err) => {
                console.warn(`IAP req ERROR ${err.code}`, err.message);
            });
        console.log("Purchasing products...");
    };


    UNSAFE_componentWillReceiveProps(nextProps) {
        (nextProps.isPurchaseForFriendSuccess ||
            nextProps.isPurchaseForFriendFailure) &&
            this.setState({ isPurchaseSuccess: true });
    }


    // Updates a specific input field in the component state.
    updateInputField = (inputName, inputValue) => {
        const { phone, isPhoneIsValid, isNameIsValid } = this.state;

        if (inputName === "name" && inputValue !== "" && !isNameIsValid) {
            this.setState({ isNameIsValid: true });
        }

        inputName === "name" &&
            this.setState((state) => ({
                ...state,
                [inputName]: inputValue,
            }));

        if (inputName === "phone") {
            const value = inputValue
                .split("")
                .filter((i) => i !== " ")
                .join("");

            this.setState((state) => ({
                ...state,
                [inputName]: value,
            }));
        }
    };

    // Updates the validation status of the phone number input.
    setPhoneValidationStatus = (isValid) => {
        this.setState({
            isPhoneIsValid: isValid,
        });
    };

    // Initiates the purchase process for a selected product.
    initiateFriendPurchase = async () => {
        console.log("purchase pres", this.state.products);

        if (typeof this.state.products === "undefined") {
            console.log("products = undefined ");
        } else {
            if (this.state.products?.length > 0) {
                this.purchase(this.state.products[0].productId);
            }
        }
    };

    //   Processes the result returned after a purchase attempt.
    processPurchaseResult = (result) => {
        const { name, phone, category_id } = this.state;
        this.setState(
            {
                isNameIsValid: true,
                isPhoneIsValid: true,
            },
            () => {
                AsyncStorage.getItem("user").then((token) => {
                    this.props.dispatch(
                        userActions.purchaseSubscriptionForFriend(
                            {
                                name,
                                phone,
                                category_id: category_id,
                                purchased: 1,
                                resultPurchaseToken: result.purchaseToken
                                    ? result.purchaseToken
                                    : null,
                                resultPackageName: result.packageNameAndroid
                                    ? result.packageNameAndroid
                                    : null,
                                resultProductId: result.productId
                                    ? result.productId
                                    : result.transactionId,
                                transactionReceipt:
                                    Platform.OS === "ios" ? result.transactionReceipt : null,
                                lang: this.props.i18n.locale,
                                platform: Platform.OS,
                                transactionId:
                                    Platform.OS === "ios" ? result.transactionId : null,
                                allInfoResult: result,
                                os: Platform.OS,
                            },
                            token
                        )
                    );
                });
            }
        );
        this.setState({
            isModalVisible: false,
            isInfoModalVisible: true,
        });
    };

    // Handles switching to "purchase for friend" mode and validates input fields
    handlePurchaseValue = () => {
        const { name, phone, category_id, isPurchaseForFriend } = this.state;

        if (!name || !phone || !validatePhoneNumber(phone) || !category_id) {
            this.setState(
                {
                    isNameIsValid: !name ? false : true,
                    isPhoneIsValid: !phone || !validatePhoneNumber(phone) ? false : true,
                    isCategoryIsValid: !category_id ? false : true,
                },
                () => this.scrollView.scrollToEnd()
            );
            return;
        } else if (isPurchaseForFriend) {
            this.setState({ isModalVisible: true });
        } else {
            this.initiateFriendPurchase();
        }
    };

    // Handles switching to "purchase for friend" mode and validates input fields.  
    handlePurchaseSwitch = (purchased) => {
        this.setState(
            {
                isPurchaseForFriend: true,
            },
            this.handlePurchaseValue()
        );
    };

    handleBuyModalClose = () => {
        this.setState({ isModalVisible: false });
    };

    handleInfoModalClose = () => {
        this.setState({ isInfoModalVisible: false, isPurchaseSuccess: false });
        this.props.navigation.navigate("MainPage");
    };

    onShare = async () => {
        const message = `${this.props.t(
            "common:pages.buy_for_friend.shar_friends_message"
        )}`;
        try {
            const result = await Share.share({
                message,
            });
            if (result.action === Share.sharedAction) {
                console.log("result.activityType  ", result.activityType);
                if (result.activityType) {
                    // shared with activity type of result.activityType
                } else {
                    // shared
                }
            } else if (result.action === Share.dismissedAction) {
                // dismissed
            }
        } catch (error) { }
    };

    // modal functional


    // Adjusts the scroll position and footer visibility based on the content offset.
    onScrollContent = (event) => {
        let y = event.nativeEvent.contentOffset.y;
        let end = this.hasReachedScrollEnd(event.nativeEvent);

        if (y <= 0) {
            this.setState({ isStartScroll: true, isEndScroll: true });
        } else if (end) {
            this.setState({ isEndScroll: false, isStartScroll: false });
        } else {
            this.setState({ isStartScroll: true, isEndScroll: false });
        }
    };

    // Determines if the user has scrolled to the bottom of the content.
    hasReachedScrollEnd = ({ layoutMeasurement, contentOffset, contentSize }) => {
        const paddingToBottom = 10;
        return (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom
        );
    };

    handleCheck = (id, title) => {
        this.setState({
            category_id: id,
            categoriasName: title,
            isSelectModal: false,
            isCategoryIsValid: true,
        });
    };

    // keyboard
    _keyboardDidShow() {
        this.setState({ isShowFooter: false });
    }

    _keyboardDidHide() {
        this.setState({ isShowFooter: true });
    }

    render() {
        const {
            name,
            phone,
            isPurchaseSuccess,
            isErrorIAP,
            isNameIsValid,
            isPhoneIsValid,
            isCategoryIsValid,
            isModalVisible,
            isInfoModalVisible,
            isSelectModal,
        } = this.state;
        const {

            i18n,
            getCategoriesSuccess,
            getCategoriesFailure,
            isPurchaseForFriendRequest,
            isPurchaseForFriendSuccess,
            isPurchaseForFriendFailure,
        } = this.props;
        return (
            <SafeAreaView style={styles.keyboardView}>
                <SowUpYourLife />

                <Header
                    text={t("common:pages.buy_for_friend.header")}
                />

                <View>
                    <IconGift width={25} height={25} />
                </View>
                <ScrollView
                    style={styles.scrollContainer}
                    ref={(r) => (this.scrollView = r)}
                    showsVerticalScrollIndicator={false}
                >
                    {!getCategoriesFailure.message ? (
                        <View style={styles.container}>
                            <LinearGradientLabel
                                checked={true}
                                i18n={i18n}
                                defaultStyle={styles.textAlignCenter}
                                text={t("common:pages.buy_for_friend.info_label")}
                            />
                            <LinearGradientInput
                                i18n={i18n}
                                name="name"
                                showDot={false}
                                placeholder={t("common:pages.buy_for_friend.full_name")}
                                stateValue={name}
                                handleChange={this.updateInputField}
                                defaultStyle={[styles.textAlignCenter]}
                            />
                            <LinearGradientInput
                                name="phone"
                                i18n={i18n}
                                showDot={false}
                                placeholder={t("common:pages.buy_for_friend.phone")}
                                stateValue={phone || "+1"}
                                keyboardType="phone-pad"
                                handleChange={this.updateInputField}
                                defaultStyle={[styles.textAlignCenter]}
                                onValide={this.setPhoneValidationStatus}
                                display={styles.display}
                            />
                            <LinearGradientLabel
                                checked={true}
                                i18n={i18n}
                                defaultStyle={styles.textAlignCenter}
                                text={t("common:pages.buy_for_friend.topic_label")}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.select,
                                    i18n.isRTL && { flexDirection: "row-reverse" },
                                ]}
                                activeOpacity={0.6}
                                onPress={() => this.setState({ isSelectModal: true })}
                            >
                                <View style={{ width: 12 }} />
                                <Text
                                    style={i18n.isRTL ? styles.selectText : styles.selectTextEn}
                                >
                                    {!this.state.categoriasName
                                        ? t(
                                            "common:pages.buy_for_friend.select_category_for_friend"
                                        )
                                        : this.state.categoriasName}
                                </Text>
                                <View
                                    style={
                                        !i18n.isRTL
                                            ? {
                                                textAlign: "center",
                                                alignSelf: "center",
                                            }
                                            : { textAlign: "center", alignSelf: "center" }
                                    }
                                >
                                    <Tick width={12} height={12} />
                                </View>
                            </TouchableOpacity>

                            <LinearGradientLabel
                                checked={true}
                                i18n={i18n}
                                defaultStyle={styles.textAlignCenter}
                                text={t("common:pages.buy_for_friend.purchase_label")}
                            />
                            <View style={styles.switchBlock}>
                                <Switch
                                    option1={t("common:pages.short_questionnaire.no")}
                                    option2={t("common:pages.short_questionnaire.yes")}
                                    option1IsActive={false}
                                    handleShare={this.handlePurchaseSwitch}
                                    handleSwitch={this.onShare}
                                />
                            </View>
                            {!isNameIsValid && (
                                <Text
                                    style={i18n.isRTL ? styles.errorText : styles.errorTextEn}
                                >
                                    {t("common:pages.buy_for_friend.friend_full_name")}
                                </Text>
                            )}
                            {!isPhoneIsValid && (
                                <Text
                                    style={i18n.isRTL ? styles.errorText : styles.errorTextEn}
                                >
                                    {t("common:pages.buy_for_friend.invalid_phone_number")}
                                </Text>
                            )}
                            {!isCategoryIsValid && (
                                <Text
                                    style={i18n.isRTL ? styles.errorText : styles.errorTextEn}
                                >
                                    {t("common:pages.buy_for_friend.select_topic")}
                                </Text>
                            )}

                        </View>
                    ) : (
                        <LinearGradient
                            colors={
                                i18n.isRTL
                                    ? [Variables.Colors.Light_blue, Variables.Colors.Dark_blue]
                                    : [Variables.Colors.Dark_blue, Variables.Colors.Light_blue]
                            }
                            start={[0, 0]}
                            end={[1, 1]}
                            style={styles.footerTextBlock}
                        >
                            <Text
                                style={i18n.isRTL ? styles.footerText : styles.footerTextEn}
                            >
                                {t("common:connect.error_connect_1")},{" "}
                                {t("common:connect.error_connect_2")}
                            </Text>
                        </LinearGradient>
                    )}

                    <CustomModal
                        nameInState="modalVisible"
                        visible={modalVisible}
                        title={t("common:pages.registration.modal_confirm.title")}
                        description={t(
                            "common:pages.registration.modal_confirm.description"
                        )}
                        handleClose={this.handleBuyModalClose}
                        handleCloseModalVisible={this.initiateFriendPurchase}
                        handleAction={this.handleBuyModalClose}
                        bottonCloseText={t("common:pages.registration.modal_confirm.buy")}
                        bottonActionText={t(
                            "common:pages.registration.modal_confirm.cancel"
                        )}
                        t={t}
                    />
                    {isPurchaseForFriendRequest && (
                        <Spinner isLoading={isPurchaseForFriendRequest} />
                    )}

                    {isPurchaseSuccess &&
                        isPurchaseForFriendSuccess &&
                        !isPurchaseForFriendRequest && (
                            <CustomModal
                                type="info"
                                nameInState="isInfoModalVisible"
                                visible={isInfoModalVisible}
                                title={t(
                                    "common:pages.registration.modal_successful_purchase.title"
                                )}
                                description={t(
                                    "common:pages.buy_for_friend.modal_successful_purchase.description"
                                )}
                                handleClose={this.handleInfoModalClose}
                                t={t}
                            />
                        )}

                    <CustomModal
                        type="info"
                        nameInState="isInfoModalVisible"
                        visible={isErrorIAP}
                        title={t("common:pages.registration.chort_error_messages")}
                        description={t("common:pages.registration.error_messages")}
                        handleClose={() => {
                            this.setState({ isErrorIAP: false });
                        }}
                        t={t}
                    />
                </ScrollView>

                <SelectModal
                    nameInState="isInfoModalVisible"
                    visible={isSelectModal && getCategoriesSuccess}
                    title={"selector title"}
                    handleClose={() => {
                        this.setState({ isSelectModal: false });
                    }}
                    isEndScroll={this.state.isEndScroll}
                    isStartScroll={this.state.isStartScroll}
                    onScrollContent={this.onScrollContent}
                    handleCheck={this.handleCheck}
                    categories={this.props.categories}
                />

                {this.state.isShowFooter && (
                    <Footer
                        withLeftNavigation={true}
                        onLeftPress={() => goBack()}
                    />
                )}
            </SafeAreaView>
        );
    }
}

function mapStateToProps(state) {
    const { getCategoriesSuccess, categories, getCategoriesFailure } =
        state.categoriesReducer;

    const {
        isPurchaseForFriendRequest,
        isPurchaseForFriendSuccess,
        isPurchaseForFriendFailure,
    } = state.userReducer;

    const { lang } = state.languageReducer;

    return {
        getCategoriesSuccess,
        categories,
        isPurchaseForFriendRequest,
        isPurchaseForFriendSuccess,
        isPurchaseForFriendFailure,
        lang,
        getCategoriesFailure,
    };
}

export default connect(mapStateToProps)(BuyForFriend);