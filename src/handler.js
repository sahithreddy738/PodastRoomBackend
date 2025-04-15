exports.hello = async (event) => {

  const res="hello world"
  const res2=JSON.stringify(res)
  return {
    statusCode: 200,
    body:
     JSON.stringify({
      message: "working ,write api now!",
    }),
  };
}




