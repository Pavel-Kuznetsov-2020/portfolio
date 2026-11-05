const newProductForm = document.querySelector("#new-product");
const newProductResult = document.querySelector("#product-result");
const newProductCurrency = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 2, minimumFractionDigits: 2,
});

function updateNewProduct() {
  if (!newProductForm.checkValidity()) {
    newProductResult.classList.remove("loss");
    newProductResult.textContent = "Проверьте значения в полях калькулятора.";
    return;
  }
  const { price, cost, fee, buyout, direct, reverse, tax, storage, ad } =
    Object.fromEntries([...new FormData(newProductForm)].map(([key, value]) => [key, Number(value)]));
  const ratio = buyout / 100;
  const logistics = direct / ratio + reverse * (1 / ratio - 1);
  const margin = price - cost - price * (fee + ad) / 100 - tax - storage - logistics;
  newProductResult.classList.toggle("loss", margin < 0);
  newProductResult.textContent =
    "Логистика на выкуп — " + newProductCurrency.format(logistics) +
    " · Маржа на выкуп — " + newProductCurrency.format(margin);
}

newProductForm.addEventListener("input", updateNewProduct);
newProductForm.addEventListener("submit", (event) => event.preventDefault());
updateNewProduct();
