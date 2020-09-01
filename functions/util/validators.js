
const isEmail = (email) => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return email.match(emailRegEx);
}


const isEmpty = (field) => {
    console.log(field);
    return field.trim() === '';
}

exports.validateSignupUser = (data) => {
    let errors = {};

    if(isEmpty(data.email)){
        errors.email = 'email cannot be empty';
    } else if(!isEmail(data.email)){
        errors.email = 'email must be valid';
    }

    if(isEmpty(data.password)) errors.password = 'paswword cannot be empty';

    if(data.password !== data.confirmPassword) errors.confirmPassword = 'passwords do not match';

    if(isEmpty(data.handle)) errors.handle = 'handle cannot be empty';
    
    return {
        errors,
        valid: Object.keys(errors).length === 0 
    } 
}

exports.validateLoginUser = (data) => {
    let errors = {};

    if(isEmpty(data.email)){
        errors.email = 'email cannot be empty';
    } else if(!isEmail(data.email)){
        errors.email = 'email must be valid';
    }

    if(isEmpty(data.password)) errors.password = 'paswword cannot be empty';

    return {
        errors,
        valid: Object.keys(errors).length === 0 
    }
}